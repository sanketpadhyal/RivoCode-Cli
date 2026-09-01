# RivoCode CLI Website

The official website and documentation portal for **RivoCode CLI** — The Autonomous Terminal AI Coding Assistant.

## Features Included in the Website
- **Modern Dark UI Aesthetic**: Pure OLED blacks, glassmorphism, and neon emerald/cyan/purple glowing accents.
- **Interactive Quick Install Bar**: Supports `npx (Instant Run)`, `npm`, `bun`, `pnpm`, `brew`, and `yarn` with one-click copy.
- **Dedicated Universal Multi-Platform Section**:
  - 🍏 **macOS**: Apple Silicon M1-M4 & Intel x64
  - 🪟 **Windows**: Native PowerShell, Command Prompt & WSL 2
  - 🐧 **Linux**: Ubuntu, Debian, Arch Linux, Fedora, Alpine
  - 🤖 **Android**: Termux mobile CLI workflow & AArch64 ARM64
  - 🍏 **iOS / iPadOS**: iSH Shell, Blink Shell & SSH remote dev containers
- **Interactive Terminal Simulator**: 4 live scenarios demonstrating Plan Mode, Multi-Subagent Swarms, Multi-File Atomic Diffs, and OpenTUI Chat with `/model` switcher.
- **Core Capabilities & Modes Breakdown**: Tree-Sitter 2.0 WebAssembly AST indexer, autonomous subagents, unified diffs, self-healing test loops, and OpenTUI 60FPS streaming.
- **Supported LLM Providers Matrix**: Google Gemini, Anthropic Claude, OpenAI, DeepSeek, MiniMax, and OpenRouter with copyable `.env` setup snippets.
- **CLI Flags & Slash Commands Cheatsheet**: Searchable, copyable reference for all options.
- **Changelog & Architecture Documentation**: Whitepaper guide at `/blog`.

## Development

```bash
# Install dependencies
bun install   # or npm install

# Start development server
bun run start # or npm start

# Build production bundle
bun run build # or npm run build
```

---
&copy; Sanket Padhyal. Licensed under the [MIT License](../LICENSE).
