#!/usr/bin/env node

import { spawn, execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  createWriteStream,
  chmodSync,
  unlinkSync,
  readFileSync,
  renameSync,
  readdirSync,
} from 'node:fs';
import { homedir, platform, arch } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json version
function getPackageVersion() {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version || '2.0.0';
  } catch {
    return '2.0.0';
  }
}

const GITHUB_REPO = 'sanketpadhyal/RivoCode-Cli';
const VERSION = getPackageVersion();

function getTargetInfo() {
  const osType = platform();
  const archType = arch();

  if (osType === 'darwin') {
    if (archType === 'arm64') {
      return {
        target: 'darwin-arm64',
        binaryName: 'rivo-darwin-arm64',
        archiveName: 'rivo-darwin-arm64.tar.gz',
        isZip: false,
        isWindows: false,
      };
    }
    if (archType === 'x64') {
      return {
        target: 'darwin-x64',
        binaryName: 'rivo-darwin-x64',
        archiveName: 'rivo-darwin-x64.tar.gz',
        isZip: false,
        isWindows: false,
      };
    }
  } else if (osType === 'linux' || osType === 'android') {
    if (archType === 'x64') {
      return {
        target: 'linux-x64',
        binaryName: 'rivo-linux-x64',
        archiveName: 'rivo-linux-x64.tar.gz',
        isZip: false,
        isWindows: false,
      };
    }
    if (archType === 'arm64' || archType === 'arm') {
      return {
        target: 'linux-arm64',
        binaryName: 'rivo-linux-arm64',
        archiveName: 'rivo-linux-arm64.tar.gz',
        isZip: false,
        isWindows: false,
      };
    }
  } else if (osType === 'win32') {
    if (archType === 'x64') {
      return {
        target: 'win32-x64',
        binaryName: 'rivo-windows-x64.exe',
        archiveName: 'rivo-windows-x64.exe.zip',
        isZip: true,
        isWindows: true,
      };
    }
  }

  throw new Error(
    `Unsupported platform: ${osType} (${archType}).\n` +
      `RivoCode supports macOS (arm64, x64), Linux (x64, arm64), and Windows (x64).`
  );
}

function safeUnlink(filePath) {
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
    } catch {}
  }
}

function downloadFile(url, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error('Too many redirects when downloading binary.'));
    }

    const client = url.startsWith('https:') ? https : http;

    client
      .get(url, { headers: { 'User-Agent': 'rivocode-installer' } }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return resolve(
            downloadFile(res.headers.location, dest, maxRedirects - 1)
          );
        }

        if (res.statusCode !== 200) {
          return reject(
            new Error(
              `Failed to download binary: HTTP ${res.statusCode} ${res.statusMessage}`
            )
          );
        }

        const fileStream = createWriteStream(dest);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve());
        });

        fileStream.on('error', (err) => {
          safeUnlink(dest);
          reject(err);
        });
      })
      .on('error', (err) => {
        safeUnlink(dest);
        reject(err);
      });
  });
}

function extractArchive(archivePath, destDir, isZip) {
  if (isZip) {
    // Windows ZIP extraction
    try {
      execSync(`tar -xf "${archivePath}" -C "${destDir}"`, { stdio: 'ignore' });
    } catch {
      execSync(
        `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`,
        { stdio: 'ignore' }
      );
    }
  } else {
    // Unix tar.gz extraction
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

async function ensureBinary() {
  const targetInfo = getTargetInfo();

  // If local binary exists in development tree, prefer it
  const localDevBinary = join(
    __dirname,
    '..',
    'cli',
    'bin',
    targetInfo.isWindows ? 'rivo.exe' : 'rivo'
  );
  if (process.env.RIVO_LOCAL === '1' && existsSync(localDevBinary)) {
    return localDevBinary;
  }

  const cacheBase = join(homedir(), '.rivocode', 'bin', `v${VERSION}`);
  const finalBinaryName = targetInfo.isWindows ? 'rivo.exe' : 'rivo';
  const finalBinaryPath = join(cacheBase, finalBinaryName);

  if (existsSync(finalBinaryPath)) {
    return finalBinaryPath;
  }

  // Create directory
  mkdirSync(cacheBase, { recursive: true });

  const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${targetInfo.archiveName}`;
  const tempArchive = join(cacheBase, targetInfo.archiveName);

  console.log(`\x1b[36m⚡ Downloading RivoCode v${VERSION} (${targetInfo.target})...\x1b[0m`);

  try {
    await downloadFile(downloadUrl, tempArchive);
    console.log(`\x1b[32m✔ Download complete. Installing...\x1b[0m`);

    extractArchive(tempArchive, cacheBase, targetInfo.isZip);

    // If the extracted binary was named target-specific (e.g. rivo-darwin-arm64), rename to rivo
    const rawBinaryPath = join(cacheBase, targetInfo.binaryName);
    if (existsSync(rawBinaryPath) && rawBinaryPath !== finalBinaryPath) {
      renameSync(rawBinaryPath, finalBinaryPath);
    }

    // Fallback search if target binary was not found directly at finalBinaryPath
    if (!existsSync(finalBinaryPath)) {
      const files = readdirSync(cacheBase);
      const matched = files.find(
        (f) => f.startsWith('rivo') && !f.endsWith('.tar.gz') && !f.endsWith('.zip')
      );
      if (matched) {
        renameSync(join(cacheBase, matched), finalBinaryPath);
      }
    }

    if (!existsSync(finalBinaryPath)) {
      throw new Error(`Extracted binary was not found at ${finalBinaryPath}`);
    }

    if (!targetInfo.isWindows && existsSync(finalBinaryPath)) {
      chmodSync(finalBinaryPath, 0o755);
    }

    // Clean up archive
    safeUnlink(tempArchive);

    return finalBinaryPath;
  } catch (err) {
    // Clean up on failure
    safeUnlink(tempArchive);
    throw new Error(
      `Failed to install RivoCode v${VERSION}:\n${err.message}\n` +
        `You can manually download the binary from: https://github.com/${GITHUB_REPO}/releases/tag/v${VERSION}`
    );
  }
}

async function main() {
  try {
    const binaryPath = await ensureBinary();
    const args = process.argv.slice(2);

    const child = spawn(binaryPath, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 0);
      }
    });

    child.on('error', (err) => {
      console.error('\x1b[31mFailed to start RivoCode:\x1b[0m', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('\x1b[31mError:\x1b[0m', err.message);
    process.exit(1);
  }
}

main();
