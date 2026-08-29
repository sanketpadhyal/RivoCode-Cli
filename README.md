# RivoCode

> **An Agentic Terminal AI Coding Assistant & Framework**  
> *Created and Developed by **Sanket Padhyal***

[![Repository](https://img.shields.io/badge/GitHub-RivoCode--Cli-blue)](https://github.com/sanketpadhyal/RivoCode-Cli.git)
[![Runtime](https://img.shields.io/badge/Runtime-Bun-f472b6)](https://bun.sh)
[![Architecture](https://img.shields.io/badge/UI-OpenTUI%20%2B%20React-green)](https://github.com/opentui)

---

## Overview

**RivoCode** is a terminal-based AI coding assistant and agent orchestration environment designed for developers who want an interactive, responsive terminal UI (TUI) with multi-model streaming, intelligent codebase indexing, and automated tool execution.

---

## Project Structure

```
RivoCode-Cli/
├── cli/                 # Terminal UI application (OpenTUI + React 19)
│   ├── src/entry.ts     # CLI entry point
│   ├── src/index.tsx    # Terminal renderer & application startup
│   ├── src/app.tsx      # Main application state & UI tree
│   ├── src/chat.tsx     # Chat interface, prompt execution, and streaming
│   ├── src/commands/    # CLI command definitions
│   └── src/components/  # TUI widgets, status bars, spinners, inputs
│
├── agents/              # Built-in agent definitions and prompt templates
├── common/              # Shared schemas, constants, types, and file utilities
├── sdk/                 # Core agent framework, Ripgrep integration, and tools
└── packages/            # Modular sub-packages
    ├── agent-runtime/   # Agent execution lifecycle & token counting
    ├── code-map/        # AST parsing and codebase indexing via Tree-Sitter
    └── llm-providers/   # LLM streaming clients & provider abstractions
```

---

## Opening & Running RivoCode

### 1. Prerequisites

Make sure you have **[Bun](https://bun.sh)** installed:

```bash
# Install Bun (macOS/Linux)
curl -fsSL https://bun.sh/install | bash
```

### 2. Install Dependencies

In the root of the project:

```bash
bun install
```

### 3. Launching RivoCode (Opening the CLI)

To start RivoCode from anywhere in your terminal:

```bash
rivocode
```

Or pass a prompt directly:

```bash
rivocode "Help me write a feature"
```

You can also pass a prompt directly when starting:

```bash
bun --cwd cli dev "Help me inspect and refactor my project"
```

---

## Building RivoCode

### Build the SDK:

```bash
bun run build:sdk
```

### Build the Standalone Binary:

To package RivoCode into a single standalone binary executable (`rivocode`):

```bash
cd cli
bun run build:binary
```

---

## Author & Maintainer

- **Creator**: **Sanket Padhyal**
- **Repository**: [https://github.com/sanketpadhyal/RivoCode-Cli.git](https://github.com/sanketpadhyal/RivoCode-Cli.git)

