#!/usr/bin/env node

const os = require('os');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const platform = os.platform();
const architecture = os.arch();

const platformPackage = `@rivocode-cli/cli-${platform}-${architecture}`;

const platformNames = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' };
const archNames = { x64: 'x86_64', arm64: 'ARM64' };
const platformEmoji = { darwin: '🍎', linux: '🐧', win32: '🪟' };

let binaryPath;
try {
  const packageJsonPath = require.resolve(`${platformPackage}/package.json`);
  const packageDir = path.dirname(packageJsonPath);
  const binaryName = platform === 'win32' ? 'rivo.exe' : 'rivo';
  binaryPath = path.join(packageDir, 'bin', binaryName);
} catch (error) {
  const osName = platformNames[platform] || platform;
  const archName = archNames[architecture] || architecture;
  const emoji = platformEmoji[platform] || '💻';

  console.error('');
  console.error(`  ${emoji}  Platform: ${osName} (${archName})`);
  console.error(`  ❌  No binary found for ${platform}-${architecture}`);
  console.error(`  📦  Missing package: ${platformPackage}`);
  console.error('');
  console.error('  Your platform may not be supported.');
  console.error('  Supported: macOS (x64/ARM64), Linux (x64/ARM64), Windows (x64)');
  console.error('');
  process.exit(1);
}

// Show welcome message on first run
const markerDir = path.join(os.homedir(), '.rivocode');
const markerFile = path.join(markerDir, '.first-run-done');

if (!fs.existsSync(markerFile)) {
  const osName = platformNames[platform] || platform;
  const archName = archNames[architecture] || architecture;
  const emoji = platformEmoji[platform] || '💻';

  const G = '\x1b[32m';
  const C = '\x1b[36m';
  const B = '\x1b[1m';
  const D = '\x1b[2m';
  const R = '\x1b[0m';

  console.log('');
  console.log(`${B}${G}  ╔══════════════════════════════════════════╗${R}`);
  console.log(`${B}${G}  ║         RivoCode CLI installed!         ║${R}`);
  console.log(`${B}${G}  ╚══════════════════════════════════════════╝${R}`);
  console.log('');
  console.log(`  ${emoji}  ${B}Platform:${R}  ${osName} (${archName})`);
  console.log(`  📦  ${B}Binary:${R}    ${G}✔ ${platformPackage}${R}`);
  console.log(`  📍  ${B}Node:${R}      ${process.version}`);
  console.log('');

  try {
    if (!fs.existsSync(markerDir)) fs.mkdirSync(markerDir, { recursive: true });
    fs.writeFileSync(markerFile, new Date().toISOString());
  } catch {}
}

const args = process.argv.slice(2);
const result = spawnSync(binaryPath, args, { stdio: 'inherit' });

if (result.error) {
  console.error(`Failed to execute binary: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status || 0);
