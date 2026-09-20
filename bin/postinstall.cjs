#!/usr/bin/env node

const os = require('os');
const path = require('path');

const platform = os.platform();
const arch = os.arch();

const platformNames = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
};

const archNames = {
  x64: 'x86_64',
  arm64: 'ARM64',
};

const platformEmoji = {
  darwin: '🍎',
  linux: '🐧',
  win32: '🪟',
};

const osName = platformNames[platform] || platform;
const archName = archNames[arch] || arch;
const emoji = platformEmoji[platform] || '💻';

const packageName = `@rivocode-cli/cli-${platform}-${arch}`;

let binaryFound = false;
try {
  require.resolve(`${packageName}/package.json`);
  binaryFound = true;
} catch {}

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

console.log('');
console.log(`${BOLD}${GREEN}  ╔══════════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}${GREEN}  ║         RivoCode CLI installed!         ║${RESET}`);
console.log(`${BOLD}${GREEN}  ╚══════════════════════════════════════════╝${RESET}`);
console.log('');
console.log(`  ${emoji}  ${BOLD}Platform:${RESET}  ${osName} (${archName})`);
console.log(`  📦  ${BOLD}Binary:${RESET}    ${binaryFound ? `${GREEN}✔ ${packageName}${RESET}` : `${YELLOW}✘ Not found${RESET}`}`);
console.log(`  📍  ${BOLD}Node:${RESET}      ${process.version}`);
console.log('');

if (binaryFound) {
  console.log(`  ${DIM}Get started by running:${RESET}`);
  console.log('');
  console.log(`    ${BOLD}${CYAN}$ rivo${RESET}`);
  console.log('');
} else {
  console.log(`  ${YELLOW}⚠  No binary found for ${platform}-${arch}.${RESET}`);
  console.log(`  ${YELLOW}   Your platform may not be supported.${RESET}`);
  console.log('');
}
