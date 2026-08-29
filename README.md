# CLI Project

A terminal-based AI coding assistant and CLI interface built with OpenTUI and React.

## Project Structure

- `cli/`: Terminal UI (TUI) application, rendering components, and command entry points.
- `common/`: Shared utilities, schemas, constants, and types.
- `sdk/`: Core agent framework, tool integrations, and file search/manipulation.
- `packages/`:
  - `packages/agent-runtime`: Agent runtime lifecycle and execution.
  - `packages/code-map`: AST parsing and codebase indexing.
  - `packages/llm-providers`: LLM client providers and streaming handlers.
- `agents/`: Agent definitions and configurations.

## Getting Started

### Development

To start the CLI in development mode:

```bash
bun start-cli
```

Or from inside the `cli/` workspace:

```bash
cd cli
bun dev
```

### Building

To build the SDK:

```bash
bun run build:sdk
```

To build the CLI binary:

```bash
cd cli
bun run build:binary
```
