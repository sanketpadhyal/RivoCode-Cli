#!/usr/bin/env node

const os = require('os');
const { spawnSync } = require('child_process');
const path = require('path');

const platform = os.platform();
const architecture = os.arch();

const platformPackage = `@rivocode-cli/cli-${platform}-${architecture}`;

let binaryPath;
try {
  const packageJsonPath = require.resolve(`${platformPackage}/package.json`);
  const packageDir = path.dirname(packageJsonPath);
  const binaryName = platform === 'win32' ? 'rivo.exe' : 'rivo';
  binaryPath = path.join(packageDir, 'bin', binaryName);
} catch (error) {
  console.error(`Error: Unsupported platform or architecture: ${platform}-${architecture}`);
  console.error(`Please ensure the optional dependency ${platformPackage} was installed.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync(binaryPath, args, { stdio: 'inherit' });

if (result.error) {
  console.error(`Failed to execute binary: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status || 0);
