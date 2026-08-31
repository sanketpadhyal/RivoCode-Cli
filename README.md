# RivoCode.

> **An Agentic Terminal AI Coding Assistant & Framework**  
> *Created and Developed by **Sanket Padhyal***

[![Repository](https://img.shields.io/badge/GitHub-RivoCode--Cli-blue)](https://github.com/sanketpadhyal/RivoCode-Cli.git)
[![Runtime](https://img.shields.io/badge/Runtime-Bun-f472b6)](https://bun.sh)
[![Architecture](https://img.shields.io/badge/UI-OpenTUI%20%2B%20React-green)](https://github.com/opentui)

---

## Overview

**RivoCode** is a terminal-based AI coding assistant and agent orchestration environment designed for developers who want an interactive, responsive terminal UI (TUI) with multi-model streaming, intelligent codebase indexing, and automated tool execution.

### Key Features

- 🎨 **Rich Terminal UI** — Built with OpenTUI + React 19, featuring interactive spinners, status bars, input fields, and card-based layouts
- 🤖 **Multi-Model Support** — Choose from MiniMax M2.7 (196k ctx), Meta Llama 3.3 70B (free), and Google Gemini 3.6 Flash (1M ctx)
- 📎 **Attachment System** — Attach and preview text, images, and files directly in the chat with a clean card-based UI
- 📝 **Markdown Rendering** — Rendered markdown output with code blocks, syntax highlighting, and inline formatting in the terminal
- 🔄 **Real-time Streaming** — Live token streaming from AI models with token counting and usage metrics
- 🗂️ **Project Context** — Automatic project context indexing and management for smarter AI responses
- 📁 **Codebase Indexing** — AST-based parsing via Tree-Sitter for intelligent code understanding
- 🔧 **Tool Execution** — Automated tool execution with Ripgrep integration and modular agent framework

---

## Project Structure

```
RivoCode-Cli/
├── cli/                 # Terminal UI application (OpenTUI + React 19)
│   ├── src/
│   │   ├── entry.ts     # CLI entry point
│   │   ├── index.tsx    # Terminal renderer & application startup
│   │   ├── app.tsx      # Main application state & UI tree
│   │   ├── chat.tsx     # Chat interface, prompt execution & streaming
│   │   ├── components/  # TUI widgets & UI components
│   │   │   ├── attachment-card.tsx      # Base attachment card
│   │   │   ├── text-attachment-card.tsx # Text attachment display
│   │   │   ├── image-card.tsx           # Image attachment display
│   │   │   ├── model-picker-screen.tsx  # AI model selector
│   │   │   ├── pending-attachments-banner.tsx  # Pending file banner
│   │   │   ├── markdown-renderer.tsx    # Markdown to TUI rendering
│   │   │   └── ...
│   │   ├── hooks/       # React hooks (theme, logo, dimensions)
│   │   ├── services/    # AI service implementations
│   │   │   └── real-ai-service.ts  # Real AI streaming & provider
│   │   ├── context/     # React context providers
│   │   │   └── project-context.ts  # Project context management
│   │   └── utils/       # Utilities (exit, terminal detection)
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

## Available AI Models

| Model | Provider | Context | Badge |
|-------|----------|---------|-------|
| `minimax-free` | MiniMax M2.7 via OpenRouter | 196k tokens | Free Tier |
| `llama-3.3-70b-free` | Meta Llama 3.3 via OpenRouter | — | Free Tier |
| `gemini-3.6-flash` | Google Gemini via AI Studio | 1M tokens | Fast & Recommended |

> **Note:** Use `gemini-3.6-flash` for large codebases and deep reasoning tasks. Free tier models are great for quick sessions and basic coding.

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

### 3. Launching RivoCode

To start RivoCode from anywhere in your terminal:

```bash
rivocode
```

Or pass a prompt directly:

```bash
rivocode "Help me write a feature"
```

You can also use:

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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| UI Framework | [OpenTUI](https://github.com/opentui) + React 19 |
| Language | TypeScript (strict) |
| LLM Providers | OpenRouter API, Google AI Studio |
| Code Analysis | Tree-Sitter |
| Schema Validation | Zod |

---

## Author & Maintainer

- **Creator**: **Sanket Padhyal**
- **Repository**: [https://github.com/sanketpadhyal/RivoCode-Cli.git](https://github.com/sanketpadhyal/RivoCode-Cli.git)
- **License**: Apache-2.0
