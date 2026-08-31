# Rivo CLI

A modern, AI-powered CLI tool for developers that brings intelligent code assistance directly to your terminal.

## Features

### Chat Interface
- Interactive chat with AI assistants directly in your terminal
- Syntax-highlighted code blocks with copy support
- Markdown rendering for rich responses
- Message threading for conversation context

### Attachment System
- Attach text, images, and files to messages
- Preview cards for different attachment types
- Pending attachments banner showing queued items
- Support for multiple file formats

### AI Model Integration
- Multiple AI provider support:
  - MiniMax
  - Llama 3.3
  - Gemini
- Easy model switching via model picker
- Streaming responses for real-time output

### Project Context
- Codebase-aware AI assistance
- AST-based indexing for intelligent context
- Automatic project structure analysis
- Vector embeddings for semantic search

### File Tools
- Read, write, and edit files directly from chat
- Run terminal commands
- Search and replace across files
- Create and manage project structure

## Tech Stack

- **React Native** / **Expo** for cross-platform mobile support
- **TypeScript** for type safety
- **Expo Router** for file-based navigation
- **Zustand** for state management
- **TanStack Query** for data fetching
- **OpenAI SDK** for AI integrations

## Project Structure

```
cli/
├── src/
│   ├── app/                 # Expo Router screens
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API and AI service integrations
│   ├── stores/              # Zustand state stores
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── assets/                  # Static assets
└── app.json                 # Expo configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd rivocode

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Configuration

Set up your AI provider API keys:

```bash
# Add to your environment or .env file
MINIMAX_API_KEY=your_api_key
OPENAI_API_KEY=your_api_key
GEMINI_API_KEY=your_api_key
```

## Usage

### Starting the CLI

```bash
npx expo start
```

### Chat Commands

- `/help` - Show available commands
- `/model [name]` - Switch AI model
- `/clear` - Clear conversation history
- `/attach [file]` - Attach file to message

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
