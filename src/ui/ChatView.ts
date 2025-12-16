import { ItemView, WorkspaceLeaf, setIcon, MarkdownRenderer } from 'obsidian';
import { AIService, StreamCallback } from '../services/AIService';
import { SmartQA, ConversationMessage } from '../features/SmartQA';
import { RAGSearch } from '../features/RAGSearch';

export const CHAT_VIEW_TYPE = 'local-ai-chat-view';

export class ChatView extends ItemView {
  private aiService: AIService;
  private smartQA: SmartQA | null = null;
  private ragSearch: RAGSearch | null = null;
  private chatContainer: HTMLElement;
  private inputContainer: HTMLElement;
  private inputTextarea: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private messages: ConversationMessage[] = [];
  private useRAG: boolean = true;
  private isStreaming: boolean = false;

  constructor(
    leaf: WorkspaceLeaf,
    aiService: AIService,
    smartQA?: SmartQA,
    ragSearch?: RAGSearch
  ) {
    super(leaf);
    this.aiService = aiService;
    this.smartQA = smartQA || null;
    this.ragSearch = ragSearch || null;
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'AI Chat';
  }

  getIcon(): string {
    return 'message-circle';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('local-ai-chat-container');

    // Create header
    const header = container.createDiv({ cls: 'local-ai-chat-header' });
    header.createEl('h4', { text: 'AI Assistant' });

    const headerButtons = header.createDiv({ cls: 'local-ai-chat-header-buttons' });

    // RAG toggle
    const ragToggle = headerButtons.createEl('button', {
      cls: 'local-ai-chat-rag-toggle',
      attr: { 'aria-label': 'Toggle RAG search' },
    });
    ragToggle.setText(this.useRAG ? '📚 RAG On' : '📚 RAG Off');
    ragToggle.onclick = () => {
      this.useRAG = !this.useRAG;
      ragToggle.setText(this.useRAG ? '📚 RAG On' : '📚 RAG Off');
    };

    // Clear button
    const clearBtn = headerButtons.createEl('button', {
      cls: 'local-ai-chat-clear-btn',
      attr: { 'aria-label': 'Clear chat' },
    });
    setIcon(clearBtn, 'trash-2');
    clearBtn.onclick = () => this.clearChat();

    // Chat container
    this.chatContainer = container.createDiv({ cls: 'local-ai-chat-messages' });
    this.renderWelcomeMessage();

    // Input container
    this.inputContainer = container.createDiv({ cls: 'local-ai-chat-input-container' });

    this.inputTextarea = this.inputContainer.createEl('textarea', {
      cls: 'local-ai-chat-input',
      attr: {
        placeholder: 'Ask anything about your notes...',
        rows: '1',
      },
    });

    this.inputTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.inputTextarea.addEventListener('input', () => {
      this.inputTextarea.style.height = 'auto';
      this.inputTextarea.style.height = Math.min(this.inputTextarea.scrollHeight, 150) + 'px';
    });

    this.sendButton = this.inputContainer.createEl('button', {
      cls: 'local-ai-chat-send-btn',
      attr: { 'aria-label': 'Send message' },
    });
    setIcon(this.sendButton, 'send');
    this.sendButton.onclick = () => this.sendMessage();
  }

  private renderWelcomeMessage(): void {
    const welcome = this.chatContainer.createDiv({ cls: 'local-ai-chat-welcome' });
    welcome.createEl('h3', { text: '👋 Welcome!' });
    welcome.createEl('p', { text: 'I can help you with your notes. Try asking:' });
    const suggestions = welcome.createEl('ul');
    suggestions.createEl('li', { text: '"Summarize my notes about X"' });
    suggestions.createEl('li', { text: '"What have I written about Y?"' });
    suggestions.createEl('li', { text: '"Find connections between A and B"' });
  }

  private async sendMessage(): Promise<void> {
    const query = this.inputTextarea.value.trim();
    if (!query || this.isStreaming) return;

    // Clear input
    this.inputTextarea.value = '';
    this.inputTextarea.style.height = 'auto';

    // Remove welcome message if present
    const welcome = this.chatContainer.querySelector('.local-ai-chat-welcome');
    if (welcome) welcome.remove();

    // Add user message
    this.addMessageToUI('user', query);

    // Add assistant message placeholder
    const assistantMsg = this.addMessageToUI('assistant', '');
    const contentDiv = assistantMsg.querySelector('.local-ai-chat-message-content') as HTMLElement;

    this.isStreaming = true;
    this.sendButton.disabled = true;

    try {
      if (this.useRAG && this.smartQA) {
        // Use RAG-enhanced Q&A
        const response = await this.smartQA.askQuestion(query);

        // Render the response
        await MarkdownRenderer.render(
          this.app,
          response.answer,
          contentDiv,
          '',
          this
        );

        // Show sources if available
        if (response.sources.length > 0) {
          const sourcesDiv = contentDiv.createDiv({ cls: 'local-ai-chat-sources' });
          sourcesDiv.createEl('small', { text: 'Sources:' });
          const sourceList = sourcesDiv.createEl('ul');
          for (const source of response.sources.slice(0, 3)) {
            const li = sourceList.createEl('li');
            const link = li.createEl('a', {
              text: source.title,
              cls: 'local-ai-chat-source-link',
            });
            link.onclick = () => {
              this.app.workspace.openLinkText(source.path, '');
            };
          }
        }

        this.messages.push({
          role: 'user',
          content: query,
          timestamp: Date.now(),
        });
        this.messages.push({
          role: 'assistant',
          content: response.answer,
          timestamp: Date.now(),
          sources: response.sources,
        });
      } else {
        // Direct AI chat with streaming
        const currentNoteContent = await this.getCurrentNoteContent();
        const systemPrompt = currentNoteContent
          ? `You are a helpful AI assistant. The user is currently viewing a note with the following content:\n\n${currentNoteContent}\n\nAnswer their questions helpfully.`
          : 'You are a helpful AI assistant. Answer questions clearly and concisely.';

        const chatMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...this.messages.slice(-10).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user' as const, content: query },
        ];

        let fullResponse = '';

        const callback: StreamCallback = {
          onToken: (token) => {
            fullResponse += token;
            contentDiv.textContent = fullResponse;
            this.scrollToBottom();
          },
          onComplete: async (finalResponse) => {
            contentDiv.empty();
            await MarkdownRenderer.render(
              this.app,
              finalResponse,
              contentDiv,
              '',
              this
            );
            this.messages.push({
              role: 'user',
              content: query,
              timestamp: Date.now(),
            });
            this.messages.push({
              role: 'assistant',
              content: finalResponse,
              timestamp: Date.now(),
            });
          },
          onError: (error) => {
            contentDiv.textContent = `Error: ${error.message}`;
            contentDiv.addClass('local-ai-chat-error');
          },
        };

        await this.aiService.chatStream(chatMessages, callback);
      }
    } catch (error) {
      contentDiv.textContent = `Error: ${(error as Error).message}`;
      contentDiv.addClass('local-ai-chat-error');
    } finally {
      this.isStreaming = false;
      this.sendButton.disabled = false;
      this.scrollToBottom();
    }
  }

  private addMessageToUI(role: 'user' | 'assistant', content: string): HTMLElement {
    const msgDiv = this.chatContainer.createDiv({
      cls: `local-ai-chat-message local-ai-chat-message-${role}`,
    });

    const avatar = msgDiv.createDiv({ cls: 'local-ai-chat-avatar' });
    avatar.setText(role === 'user' ? '👤' : '🤖');

    const contentDiv = msgDiv.createDiv({ cls: 'local-ai-chat-message-content' });
    if (content) {
      contentDiv.textContent = content;
    }

    this.scrollToBottom();
    return msgDiv;
  }

  private scrollToBottom(): void {
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  private clearChat(): void {
    this.messages = [];
    this.chatContainer.empty();
    this.renderWelcomeMessage();
    if (this.smartQA) {
      this.smartQA.clearHistory();
    }
  }

  private async getCurrentNoteContent(): Promise<string | null> {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.extension === 'md') {
      return await this.app.vault.cachedRead(activeFile);
    }
    return null;
  }

  async onClose(): Promise<void> {
    // Cleanup
  }

  updateServices(aiService: AIService, smartQA?: SmartQA, ragSearch?: RAGSearch): void {
    this.aiService = aiService;
    this.smartQA = smartQA || null;
    this.ragSearch = ragSearch || null;
  }
}
