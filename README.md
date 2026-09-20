<div align="center">

<img src="logo0.png" alt="RivoCode Logo" width="120" height="120" />

# RivoCode CLI

**A modern, terminal-native AI coding assistant built for speed, full codebase awareness, and multi-file workflows.**

[![npm version](https://img.shields.io/npm/v/@rivocode-cli/cli?style=flat-square&color=007ACC&label=npm%20package)](https://www.npmjs.com/package/@rivocode-cli/cli)
[![GitHub release](https://img.shields.io/github/v/release/sanketpadhyal/RivoCode-Cli?style=flat-square&color=green)](https://github.com/sanketpadhyal/RivoCode-Cli/releases)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)](https://github.com/sanketpadhyal/RivoCode-Cli/releases)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green?style=flat-square)](https://nodejs.org)

</div>

---

## Overview

RivoCode is an autonomous AI coding assistant that operates directly within your terminal. It indexes your project AST with Tree-Sitter, plans architectural implementations, edits multiple files across your workspace, executes shell commands, and connects to high-performance LLM providers without requiring desktop IDE context switching.

---

## What's New in v3.0.6

- 🚀 **End-to-End Autonomous Execution**: Resolved premature exit and stalling issues — RivoCode autonomously completes multi-file tasks, executes tests, and verifies results end-to-end.
- ⚡ **Live Real-Time Activity Status**: Dynamic status bar indicators (`⚡ Running: ...`, `✎ Editing ...`, `◎ Reading ...`, `⌕ Listing ...`, `◈ Fetching ...`) display real-time tool actions.
- 🧠 **Curated Free Frontier Models**: Streamlined model picker featuring top free 1M-context models:
  - **`nvidia-nemotron-3-ultra`** (550B MoE model · 1M context · OpenRouter Free Tier)
  - **`gemini-3.6-flash`** (Google Gemini · 1M context · Google AI Studio Free Tier)
- 🎯 **Clean Model Switcher**: Minimalist, distraction-free model picker displaying only essential, actionable details.
- 🎨 **Enhanced Auto-Accept Mode**: Clean pink accenting for auto-accept edits without redundant badges.
- 🛡️ **Intelligent Rate-Limit Diagnostics**: Provider-aware error reporting and automatic rate-limit recovery.

---

## Quick Start

Run RivoCode instantly without manual binary downloads:

```bash
npx @rivocode-cli/cli
```

Pass an initial prompt directly from your terminal:

```bash
npx @rivocode-cli/cli "Refactor authentication middleware to use JWT"
```

---

## Installation

Install RivoCode globally with a single universal command on **macOS**, **Windows**, or **Linux**:

```bash
npm install -g @rivocode-cli/cli
```

*(You can also use `bun add -g @rivocode-cli/cli`, `pnpm add -g @rivocode-cli/cli`, or `yarn global add @rivocode-cli/cli`)*

---

### Verify Installation

Once installed, launch RivoCode from any directory:

```bash
rivo
```

*(or use the alias `rivocode`)*

Check your installed version:

```bash
rivo --version
```

---

## Core Capabilities

### 1. Codebase Awareness & AST Mapping
RivoCode builds an abstract syntax tree (AST) map of your repository using WebAssembly Tree-Sitter grammars. It resolves functions, classes, type declarations, and imports across the entire workspace to provide accurate context.

### 2. Multi-File Atomic Editing
The agent constructs full structural modifications, validates diffs, and writes patches directly across multiple project files in a single pass.

### 3. Integrated Terminal & Tool Execution
RivoCode executes builds, linters, tests, and file system commands directly to verify implementations and self-correct runtime errors.

### 4. Zero-Latency Terminal UI
Powered by OpenTUI and React reconciler engines, RivoCode delivers syntax highlighting, markdown rendering, progress trackers, and real-time streaming tokens.

---

## AI Model Providers & Configuration

Set provider API keys in your shell environment or a local `.env` file:

```bash
# MiniMax
export MINIMAX_API_KEY="your_minimax_api_key"

# Google Gemini
export GEMINI_API_KEY="your_gemini_api_key"

# Anthropic Claude
export ANTHROPIC_API_KEY="your_anthropic_api_key"

# OpenAI
export OPENAI_API_KEY="your_openai_api_key"

# OpenRouter
export OPENROUTER_API_KEY="your_openrouter_api_key"
```

---

## CLI Options & Execution Modes

| Option | Flag | Description |
| :--- | :--- | :--- |
| **Plan Mode** | `--plan` | Generates detailed architectural roadmaps before applying code changes |
| **Lite Mode** | `--lite` | Fast execution optimized for quick edits and single-file modifications |
| **Max Mode** | `--max` | Extended reasoning mode for complex refactoring tasks |
| **Continue Session** | `--continue [id]` | Resumes an active or previous conversation session |
| **Working Directory** | `--cwd <path>` | Sets the project root path explicitly |
| **Clear Logs** | `--clear-logs` | Cleans previous session logs before starting |
| **Version** | `-v, --version` | Outputs current CLI version |
| **Help** | `-h, --help` | Displays usage instructions |

### Execution Examples:

```bash
# Start in architectural planning mode
rivo --plan

# Run a quick fix in Lite mode
rivo --lite "Fix TypeScript error in user.service.ts"

# Continue the previous session
rivo --continue
```

---

## Interactive Chat Commands

Inside the active terminal session, use slash commands to manage your workflow:

| Command | Action |
| :--- | :--- |
| `/model` | Open interactive model switcher (MiniMax, Gemini, Claude, etc.) |
| `/help` | Display list of interactive commands and shortcuts |
| `/clear` | Clear active conversation history |
| `/attach <file>` | Attach specific file context into current prompt |

---

## Architecture & Technology Stack

```
rivocode/
├── bin/                    # Universal Node.js cross-platform launcher
├── cli/                    # OpenTUI & React terminal application
│   ├── src/
│   │   ├── commands/       # CLI routing and command registration
│   │   ├── components/     # Terminal UI components
│   │   ├── hooks/          # Keyboard and lifecycle hooks
│   │   └── utils/          # AST indexing and terminal brokers
│   └── scripts/            # Cross-compilation scripts
├── sdk/                    # Core RivoCode TypeScript SDK
└── packages/
    ├── agent-runtime/      # Agent loops and tool invocation execution
    ├── code-map/           # Tree-Sitter AST indexer
    └── llm-providers/      # Multi-provider streaming adapter
```

- **Runtime & Compilation**: Bun `--compile` standalone cross-platform binaries
- **Terminal UI**: OpenTUI + React 19 + Yoga Layout engine
- **Code Parsing**: WebAssembly Tree-Sitter
- **Package Distribution**: npm registry wrapper with automated GitHub release retrieval

---

## Uninstallation

To uninstall RivoCode from **macOS**, **Windows**, or **Linux**:

```bash
npm uninstall -g @rivocode-cli/cli
```

*(Or `bun remove -g @rivocode-cli/cli`, `pnpm remove -g @rivocode-cli/cli`)*

### Clean Configuration & Cache (Optional)

#### macOS & Linux:
```bash
rm -rf ~/.rivocode
```

#### Windows (PowerShell):
```powershell
Remove-Item -Recurse -Force ~/.rivocode
```

---

## License

This project is licensed under the [MIT License](LICENSE).
