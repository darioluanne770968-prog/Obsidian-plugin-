# Obsidian Local AI Assistant

A comprehensive AI-powered assistant for Obsidian that runs entirely on your local machine. No data leaves your computer.

## Features

### 🎯 Core Features

#### Writing Assistant
- **Continue Writing** - AI continues your text naturally
- **Rewrite** - Improve clarity and flow
- **Expand** - Add more details and examples
- **Compress** - Make text more concise
- **Translate** - Multi-language translation
- **Fix Grammar** - Correct spelling and grammar
- **Change Tone** - Make formal or casual

#### Note Summarization
- Generate summaries of any note
- Extract key points
- Auto-generate titles
- Create TL;DR

### 📚 Knowledge Base (RAG)

#### Semantic Search
- Search notes using natural language
- Find notes by meaning, not just keywords
- Local vector embeddings

#### Smart Q&A
- Ask questions about your notes
- AI answers based on your knowledge base
- Shows source references
- Multi-turn conversations

#### Knowledge Graph
- Automatically extract entities
- Discover relationships between notes
- Get smart link suggestions

### ✍️ Content Generation

#### AI Templates
- Weekly review
- Meeting notes
- Blog posts
- Research notes
- Book summaries
- Project plans
- And more...

#### Outline Generator
- Generate outlines for any topic
- Multiple styles (academic, blog, technical)
- Expand sections into full content

#### Format Conversion
- Text to Markdown table
- Text to bullet lists
- Text to Mermaid diagrams:
  - Flowcharts
  - Mind maps
  - Sequence diagrams
  - Gantt charts

### 🔧 Productivity Tools

#### Auto-Tagging
- AI suggests relevant tags
- Batch tag multiple notes
- Category classification

#### Task Extraction
- Find tasks in your notes
- Extract action items from meetings
- Generate tasks from goals

#### Flashcard Generation
- Create Anki-compatible flashcards
- Basic and cloze deletion cards
- Export to Anki

### 💬 Interaction Methods

#### Sidebar Chat
- ChatGPT-style conversation
- Context-aware (knows current note)
- RAG integration

#### Context Menu
- Select text → Right-click → AI actions
- Quick access to common operations

#### Command Palette
- All features accessible via commands
- Customizable hotkeys

### 🎨 Advanced Features

#### Image Processing (Vision)
- OCR text extraction
- Image descriptions
- Chart/diagram interpretation
- Screenshot to notes

#### Voice Input
- Speech-to-text with Whisper
- Voice note creation
- Hands-free input

#### Automation Workflows
- Auto-summarize new notes
- Auto-tag on file creation
- Process meeting notes
- Custom workflows

## Installation

### Prerequisites

You need a local AI server running. Supported options:

1. **Ollama** (Recommended)
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.com/install.sh | sh

   # Pull a model
   ollama pull llama3.2

   # For embeddings
   ollama pull nomic-embed-text

   # For vision (optional)
   ollama pull llava
   ```

2. **LM Studio**
   - Download from https://lmstudio.ai
   - Load a model and start the server

3. **Any OpenAI-compatible API**

### Plugin Installation

1. Download the latest release
2. Extract to `.obsidian/plugins/local-ai-assistant/`
3. Enable the plugin in Obsidian settings
4. Configure your AI provider in plugin settings

## Configuration

### Basic Setup

1. Open Settings → Local AI Assistant
2. Select your AI provider (Ollama/LM Studio/Custom)
3. Verify the URL (default: `http://localhost:11434` for Ollama)
4. Click "Test Connection"
5. Select your preferred model

### Model Recommendations

| Use Case | Recommended Model |
|----------|------------------|
| General chat | llama3.2, mistral |
| Embeddings | nomic-embed-text |
| Vision/OCR | llava |
| Code | codellama, deepseek-coder |

## Usage Examples

### Quick Actions (Select text + Right-click)

1. Select text in your note
2. Right-click to open context menu
3. Choose an AI action:
   - Rewrite
   - Expand
   - Summarize
   - Translate

### Chat with Your Notes

1. Click the chat icon in the ribbon
2. Toggle "RAG On" to search your notes
3. Ask questions like:
   - "What have I written about productivity?"
   - "Summarize my notes on project X"
   - "Find connections between A and B"

### Generate Content

1. Open Command Palette (Ctrl/Cmd + P)
2. Search for "AI: Generate Outline"
3. Enter your topic
4. Insert the generated outline

### Auto-organize Notes

1. Open a note
2. Command: "AI: Suggest Tags"
3. Select suggested tags to apply
4. Or use "AI: Auto-tag Current Note" for automatic tagging

## Keyboard Shortcuts

Set custom hotkeys in Settings → Hotkeys:

| Command | Suggested Hotkey |
|---------|-----------------|
| Open AI Chat | Ctrl/Cmd + Shift + A |
| Rewrite Selection | Ctrl/Cmd + Shift + R |
| Summarize Note | Ctrl/Cmd + Shift + S |
| Custom Prompt | Ctrl/Cmd + Shift + P |

## Privacy

**All processing happens locally.** This plugin:
- ✅ Runs entirely on your machine
- ✅ No data sent to external servers
- ✅ No API keys for cloud services needed
- ✅ Works offline (after model download)

## Troubleshooting

### Connection Failed
- Ensure Ollama/LM Studio is running
- Check the URL in settings
- Verify firewall isn't blocking localhost

### Slow Responses
- Use a smaller model
- Reduce max tokens
- Ensure sufficient RAM (8GB+ recommended)

### Out of Memory
- Use a quantized model (e.g., Q4_K_M)
- Close other applications
- Use a smaller context window

## Development

```bash
# Clone the repo
git clone https://github.com/yourusername/obsidian-local-ai

# Install dependencies
npm install

# Development build
npm run dev

# Production build
npm run build
```

## Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file

## Support

- [GitHub Issues](https://github.com/yourusername/obsidian-local-ai/issues)
- [Discussion Forum](https://github.com/yourusername/obsidian-local-ai/discussions)
