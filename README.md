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
  - **MiniMax** (MiniMax-M3) - Fast, cost-effective LLM
  - **Llama 3.3** - Open source model
  - **Gemini** - Google's AI model
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

## MiniMax Integration

### API Setup

1. Sign up at [MiniMax Platform](https://platform.minimax.io)
2. Get your API key from the dashboard
3. Configure in your environment:

```bash
# Add to .env file
MINIMAX_API_KEY=your_api_key_here
```

### Usage with MiniMax

```bash
# Direct API call example
curl https://api.minimax.io/v1/chat/completions \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-M3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Available MiniMax Features

| Feature | Description |
|---------|-------------|
| **MiniMax-M3** | Latest LLM model |
| **Image Generation** | AI image creation |
| **Video Generation V2** | Text-to-video |
| **Text-to-Speech** | Voice synthesis |
| **Voice Design** | Custom voice creation |
| **Music Generation** | AI music creation |

### SDK Integration

```bash
npm install @ai-sdk/minimax
```

```javascript
import { createMiniMax } from '@ai-sdk/minimax';

const minimax = createMiniMax({ apiKey: process.env.MINIMAX_API_KEY });
const response = await minimax('Your question here');
```

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
- MiniMax API key (for MiniMax integration)

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
- `/model [name]` - Switch AI model (mini, llama, gemini)
- `/clear` - Clear conversation history
- `/attach [file]` - Attach file to message

### Switching Models

```
/model mini     # Use MiniMax
/model llama    # Use Llama 3.3
/model gemini   # Use Gemini
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
