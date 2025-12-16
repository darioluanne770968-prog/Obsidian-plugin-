import {
  App,
  Plugin,
  Editor,
  MarkdownView,
  Menu,
  TFile,
  Notice,
  WorkspaceLeaf,
  Modal,
} from 'obsidian';

import { AIService } from './services/AIService';
import { WritingAssistant, WritingAction } from './features/WritingAssistant';
import { NoteSummarizer } from './features/NoteSummarizer';
import { RAGSearch } from './features/RAGSearch';
import { SmartQA } from './features/SmartQA';
import { KnowledgeGraph } from './features/KnowledgeGraph';
import { AITemplates, DEFAULT_TEMPLATES } from './features/AITemplates';
import { OutlineGenerator } from './features/OutlineGenerator';
import { FormatConverter } from './features/FormatConverter';
import { AutoTagger } from './features/AutoTagger';
import { TaskExtractor } from './features/TaskExtractor';
import { FlashcardGenerator } from './features/FlashcardGenerator';
import { ImageProcessor } from './features/ImageProcessor';
import { VoiceInput } from './features/VoiceInput';
import { AutomationWorkflows } from './features/AutomationWorkflows';
import { ChatView, CHAT_VIEW_TYPE } from './ui/ChatView';
import { LocalAISettings, DEFAULT_SETTINGS, LocalAISettingTab } from './settings';

export default class LocalAIPlugin extends Plugin {
  settings: LocalAISettings;

  // Services
  aiService: AIService;
  ragSearch: RAGSearch;
  smartQA: SmartQA;

  // Features
  writingAssistant: WritingAssistant;
  summarizer: NoteSummarizer;
  knowledgeGraph: KnowledgeGraph;
  templates: AITemplates;
  outlineGenerator: OutlineGenerator;
  formatConverter: FormatConverter;
  autoTagger: AutoTagger;
  taskExtractor: TaskExtractor;
  flashcardGenerator: FlashcardGenerator;
  imageProcessor: ImageProcessor;
  voiceInput: VoiceInput;
  automationWorkflows: AutomationWorkflows;

  async onload() {
    await this.loadSettings();

    // Initialize services
    this.aiService = new AIService(this.settings);

    // Initialize features
    this.initializeFeatures();

    // Register view
    this.registerView(
      CHAT_VIEW_TYPE,
      (leaf) => new ChatView(leaf, this.aiService, this.smartQA, this.ragSearch)
    );

    // Add ribbon icon
    this.addRibbonIcon('message-circle', 'Open AI Chat', () => {
      this.activateChatView();
    });

    // Register commands
    this.registerCommands();

    // Register context menu
    this.registerContextMenu();

    // Register settings tab
    this.addSettingTab(new LocalAISettingTab(this.app, this));

    // Setup automation if enabled
    if (this.settings.enableAutomation) {
      this.setupAutomation();
    }

    // Auto-index if enabled
    if (this.settings.enableRAG && this.settings.autoIndexOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        this.indexNotes();
      });
    }

    console.log('Local AI Plugin loaded');
  }

  private initializeFeatures() {
    this.writingAssistant = new WritingAssistant(this.aiService);
    this.summarizer = new NoteSummarizer(this.aiService);
    this.ragSearch = new RAGSearch(this.aiService, this.app.vault, this.app.metadataCache);
    this.smartQA = new SmartQA(this.aiService, this.ragSearch);
    this.knowledgeGraph = new KnowledgeGraph(this.aiService, this.app.vault, this.app.metadataCache);
    this.templates = new AITemplates(this.aiService);
    this.outlineGenerator = new OutlineGenerator(this.aiService);
    this.formatConverter = new FormatConverter(this.aiService);
    this.autoTagger = new AutoTagger(this.aiService, this.app.vault, this.app.metadataCache);
    this.taskExtractor = new TaskExtractor(this.aiService);
    this.flashcardGenerator = new FlashcardGenerator(this.aiService);
    this.imageProcessor = new ImageProcessor(this.aiService, this.app.vault);
    this.voiceInput = new VoiceInput(this.settings);
    this.automationWorkflows = new AutomationWorkflows(
      this.aiService,
      this.app.vault,
      this.app.metadataCache
    );

    // Load custom templates
    this.templates.setCustomTemplates(this.settings.customTemplates);

    // Load workflows
    this.automationWorkflows.setWorkflows(this.settings.workflows);
  }

  private registerCommands() {
    // Chat
    this.addCommand({
      id: 'open-ai-chat',
      name: 'Open AI Chat',
      callback: () => this.activateChatView(),
    });

    // Writing Assistant Commands
    const writingActions: { id: string; name: string; action: WritingAction }[] = [
      { id: 'continue-writing', name: 'Continue Writing', action: 'continue' },
      { id: 'rewrite-selection', name: 'Rewrite Selection', action: 'rewrite' },
      { id: 'expand-selection', name: 'Expand Selection', action: 'expand' },
      { id: 'compress-selection', name: 'Compress Selection', action: 'compress' },
      { id: 'fix-grammar', name: 'Fix Grammar', action: 'fix_grammar' },
      { id: 'make-formal', name: 'Make Formal', action: 'make_formal' },
      { id: 'make-casual', name: 'Make Casual', action: 'make_casual' },
      { id: 'simplify', name: 'Simplify Text', action: 'simplify' },
    ];

    for (const { id, name, action } of writingActions) {
      this.addCommand({
        id: `ai-${id}`,
        name: `AI: ${name}`,
        editorCallback: (editor: Editor) => this.runWritingAction(editor, action),
      });
    }

    // Translation
    this.addCommand({
      id: 'ai-translate-to-english',
      name: 'AI: Translate to English',
      editorCallback: (editor: Editor) => this.translateSelection(editor, 'English'),
    });

    this.addCommand({
      id: 'ai-translate-to-chinese',
      name: 'AI: Translate to Chinese',
      editorCallback: (editor: Editor) => this.translateSelection(editor, 'Chinese'),
    });

    // Summarization
    this.addCommand({
      id: 'ai-summarize-note',
      name: 'AI: Summarize Current Note',
      callback: () => this.summarizeCurrentNote(),
    });

    this.addCommand({
      id: 'ai-extract-key-points',
      name: 'AI: Extract Key Points',
      callback: () => this.extractKeyPoints(),
    });

    this.addCommand({
      id: 'ai-generate-title',
      name: 'AI: Generate Title',
      callback: () => this.generateTitle(),
    });

    // Format Conversion
    this.addCommand({
      id: 'ai-to-table',
      name: 'AI: Convert to Table',
      editorCallback: (editor: Editor) => this.convertToFormat(editor, 'table'),
    });

    this.addCommand({
      id: 'ai-to-bullet-list',
      name: 'AI: Convert to Bullet List',
      editorCallback: (editor: Editor) => this.convertToFormat(editor, 'bullets'),
    });

    this.addCommand({
      id: 'ai-to-flowchart',
      name: 'AI: Convert to Flowchart',
      editorCallback: (editor: Editor) => this.convertToFormat(editor, 'flowchart'),
    });

    this.addCommand({
      id: 'ai-to-mindmap',
      name: 'AI: Convert to Mind Map',
      editorCallback: (editor: Editor) => this.convertToFormat(editor, 'mindmap'),
    });

    // Outline
    this.addCommand({
      id: 'ai-generate-outline',
      name: 'AI: Generate Outline',
      callback: () => this.showOutlineModal(),
    });

    // Tagging
    this.addCommand({
      id: 'ai-suggest-tags',
      name: 'AI: Suggest Tags',
      callback: () => this.suggestTags(),
    });

    this.addCommand({
      id: 'ai-auto-tag-note',
      name: 'AI: Auto-tag Current Note',
      callback: () => this.autoTagCurrentNote(),
    });

    // Tasks
    this.addCommand({
      id: 'ai-extract-tasks',
      name: 'AI: Extract Tasks',
      callback: () => this.extractTasks(),
    });

    // Flashcards
    this.addCommand({
      id: 'ai-generate-flashcards',
      name: 'AI: Generate Flashcards',
      callback: () => this.generateFlashcards(),
    });

    // RAG Search
    this.addCommand({
      id: 'ai-semantic-search',
      name: 'AI: Semantic Search',
      callback: () => this.showSearchModal(),
    });

    this.addCommand({
      id: 'ai-find-similar-notes',
      name: 'AI: Find Similar Notes',
      callback: () => this.findSimilarNotes(),
    });

    this.addCommand({
      id: 'ai-suggest-links',
      name: 'AI: Suggest Links',
      callback: () => this.suggestLinks(),
    });

    // Index
    this.addCommand({
      id: 'ai-index-all-notes',
      name: 'AI: Index All Notes',
      callback: () => this.indexNotes(),
    });

    // Templates
    this.addCommand({
      id: 'ai-use-template',
      name: 'AI: Use Template',
      callback: () => this.showTemplateModal(),
    });

    // Voice
    if (VoiceInput.isSupported()) {
      this.addCommand({
        id: 'ai-voice-input',
        name: 'AI: Start Voice Input',
        callback: () => this.startVoiceInput(),
      });
    }

    // Custom prompt
    this.addCommand({
      id: 'ai-custom-prompt',
      name: 'AI: Custom Prompt',
      editorCallback: (editor: Editor) => this.showCustomPromptModal(editor),
    });
  }

  private registerContextMenu() {
    if (!this.settings.showInContextMenu) return;

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
        const selection = editor.getSelection();

        if (selection) {
          menu.addSeparator();

          menu.addItem((item) => {
            item.setTitle('AI: Rewrite')
              .setIcon('pencil')
              .onClick(() => this.runWritingAction(editor, 'rewrite'));
          });

          menu.addItem((item) => {
            item.setTitle('AI: Expand')
              .setIcon('expand')
              .onClick(() => this.runWritingAction(editor, 'expand'));
          });

          menu.addItem((item) => {
            item.setTitle('AI: Summarize')
              .setIcon('file-text')
              .onClick(() => this.runWritingAction(editor, 'compress'));
          });

          menu.addItem((item) => {
            item.setTitle('AI: Translate')
              .setIcon('languages')
              .onClick(() => this.showTranslateMenu(editor, menu));
          });

          menu.addItem((item) => {
            item.setTitle('AI: Convert Format')
              .setIcon('table')
              .onClick(() => this.showFormatMenu(editor));
          });
        }
      })
    );
  }

  private setupAutomation() {
    // Register file creation handler
    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (file instanceof TFile) {
          await this.automationWorkflows.handleFileCreated(file);
        }
      })
    );

    // Register file modification handler
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          await this.automationWorkflows.handleFileModified(file);
        }
      })
    );
  }

  // Action handlers
  private async runWritingAction(editor: Editor, action: WritingAction) {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Please select some text first');
      return;
    }

    new Notice(`Processing with AI...`);

    try {
      const result = await this.writingAssistant.process(selection, action);
      editor.replaceSelection(result);
      new Notice('Done!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async translateSelection(editor: Editor, targetLanguage: string) {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Please select some text first');
      return;
    }

    new Notice(`Translating to ${targetLanguage}...`);

    try {
      const result = await this.writingAssistant.translate(selection, targetLanguage);
      editor.replaceSelection(result);
      new Notice('Translation complete!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async summarizeCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Generating summary...');

    try {
      const content = await this.app.vault.read(file);
      const summary = await this.summarizer.summarize(content);

      // Insert summary at the top
      const newContent = `> [!summary] AI Summary\n> ${summary.replace(/\n/g, '\n> ')}\n\n${content}`;
      await this.app.vault.modify(file, newContent);
      new Notice('Summary added!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async extractKeyPoints() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Extracting key points...');

    try {
      const content = await this.app.vault.read(file);
      const points = await this.summarizer.extractKeyPoints(content);

      // Insert key points
      const pointsMarkdown = `## Key Points\n${points.map(p => `- ${p}`).join('\n')}\n\n`;
      const newContent = pointsMarkdown + content;
      await this.app.vault.modify(file, newContent);
      new Notice('Key points added!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async generateTitle() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Generating title...');

    try {
      const content = await this.app.vault.read(file);
      const title = await this.summarizer.generateTitle(content);

      // Sanitize title for filename
      const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 100);
      const newPath = file.path.replace(file.basename, sanitizedTitle);

      if (newPath !== file.path) {
        await this.app.fileManager.renameFile(file, newPath);
        new Notice(`Renamed to: ${sanitizedTitle}`);
      }
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async convertToFormat(editor: Editor, format: string) {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Please select some text first');
      return;
    }

    new Notice(`Converting to ${format}...`);

    try {
      let result: string;
      switch (format) {
        case 'table':
          result = await this.formatConverter.toTable(selection);
          break;
        case 'bullets':
          result = await this.formatConverter.toBulletList(selection);
          break;
        case 'flowchart':
          result = await this.formatConverter.toMermaidFlowchart(selection);
          break;
        case 'mindmap':
          result = await this.formatConverter.toMermaidMindmap(selection);
          break;
        default:
          result = selection;
      }

      editor.replaceSelection(result);
      new Notice('Conversion complete!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async suggestTags() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Analyzing content...');

    try {
      const content = await this.app.vault.read(file);
      const suggestions = await this.autoTagger.suggestTags(content);

      if (suggestions.length === 0) {
        new Notice('No tag suggestions');
        return;
      }

      // Show suggestions in modal
      new TagSuggestionModal(this.app, suggestions, async (selectedTags) => {
        if (selectedTags.length > 0) {
          await this.autoTagger.applyTags(file, selectedTags);
          new Notice(`Added ${selectedTags.length} tags`);
        }
      }).open();
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async autoTagCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Auto-tagging...');

    try {
      const suggestions = await this.autoTagger.autoTagFile(file);
      const appliedCount = suggestions.filter(s => s.confidence >= 0.7).length;
      new Notice(`Applied ${appliedCount} tags`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async extractTasks() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Extracting tasks...');

    try {
      const content = await this.app.vault.read(file);
      const tasks = await this.taskExtractor.extractTasks(content);

      if (tasks.length === 0) {
        new Notice('No tasks found');
        return;
      }

      const tasksMarkdown = this.taskExtractor.formatTasksAsMarkdown(tasks);
      const newContent = content + '\n\n' + tasksMarkdown;
      await this.app.vault.modify(file, newContent);
      new Notice(`Extracted ${tasks.length} tasks`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async generateFlashcards() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Generating flashcards...');

    try {
      const content = await this.app.vault.read(file);
      const cards = await this.flashcardGenerator.generateBasicCards(content);

      if (cards.length === 0) {
        new Notice('No flashcards generated');
        return;
      }

      const cardsMarkdown = this.flashcardGenerator.formatAsMarkdownCards(cards);

      // Create new note with flashcards
      const flashcardPath = file.path.replace('.md', ' - Flashcards.md');
      await this.app.vault.create(flashcardPath, cardsMarkdown);
      new Notice(`Created ${cards.length} flashcards`);

      // Open the new file
      const newFile = this.app.vault.getAbstractFileByPath(flashcardPath);
      if (newFile instanceof TFile) {
        await this.app.workspace.openLinkText(newFile.path, '');
      }
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async indexNotes() {
    new Notice('Indexing notes...');

    try {
      await this.ragSearch.indexAllNotes((current, total) => {
        // Could show progress here
      });
      new Notice(`Indexed ${this.ragSearch.getIndexedCount()} notes`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async findSimilarNotes() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Finding similar notes...');

    try {
      const results = await this.ragSearch.findSimilarNotes(file.path, 5);

      if (results.length === 0) {
        new Notice('No similar notes found. Try indexing first.');
        return;
      }

      new SimilarNotesModal(this.app, results).open();
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async suggestLinks() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }

    new Notice('Finding link suggestions...');

    try {
      const content = await this.app.vault.read(file);
      const suggestions = await this.knowledgeGraph.suggestLinks(file.path, content);

      if (suggestions.length === 0) {
        new Notice('No link suggestions');
        return;
      }

      new LinkSuggestionsModal(this.app, suggestions).open();
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private showTranslateMenu(editor: Editor, menu: Menu) {
    const languages = ['English', 'Chinese', 'Japanese', 'Korean', 'Spanish', 'French', 'German'];

    for (const lang of languages) {
      menu.addItem((item) => {
        item.setTitle(lang)
          .onClick(() => this.translateSelection(editor, lang));
      });
    }
  }

  private showFormatMenu(editor: Editor) {
    new FormatPickerModal(this.app, (format) => {
      this.convertToFormat(editor, format);
    }).open();
  }

  private showOutlineModal() {
    new OutlineModal(this.app, this.outlineGenerator).open();
  }

  private showSearchModal() {
    new SearchModal(this.app, this.ragSearch, this.smartQA).open();
  }

  private showTemplateModal() {
    new TemplatePickerModal(this.app, this.templates, (result) => {
      this.insertAtCursor(result);
    }).open();
  }

  private showCustomPromptModal(editor: Editor) {
    new CustomPromptModal(this.app, this.aiService, (result) => {
      const selection = editor.getSelection();
      if (selection) {
        editor.replaceSelection(result);
      } else {
        this.insertAtCursor(result);
      }
    }, editor.getSelection()).open();
  }

  private async startVoiceInput() {
    if (!VoiceInput.isSupported()) {
      new Notice('Voice input not supported in this browser');
      return;
    }

    const hasPermission = await VoiceInput.requestPermission();
    if (!hasPermission) {
      new Notice('Microphone permission denied');
      return;
    }

    new VoiceInputModal(this.app, this.voiceInput, (text) => {
      this.insertAtCursor(text);
    }).open();
  }

  private insertAtCursor(text: string) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      const editor = view.editor;
      const cursor = editor.getCursor();
      editor.replaceRange(text, cursor);
    }
  }

  async activateChatView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(CHAT_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.aiService.updateSettings(this.settings);
    this.voiceInput.updateSettings(this.settings);
  }

  onunload() {
    console.log('Local AI Plugin unloaded');
  }
}

// Modal Classes
class TagSuggestionModal extends Modal {
  private suggestions: { tag: string; confidence: number; reason: string }[];
  private onSubmit: (tags: string[]) => void;
  private selectedTags: Set<string> = new Set();

  constructor(
    app: App,
    suggestions: { tag: string; confidence: number; reason: string }[],
    onSubmit: (tags: string[]) => void
  ) {
    super(app);
    this.suggestions = suggestions;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Suggested Tags' });

    const tagContainer = contentEl.createDiv({ cls: 'local-ai-tag-suggestions' });

    for (const suggestion of this.suggestions) {
      const tagEl = tagContainer.createDiv({ cls: 'local-ai-tag-suggestion' });
      tagEl.createSpan({ text: `#${suggestion.tag}` });
      tagEl.createSpan({
        text: `${Math.round(suggestion.confidence * 100)}%`,
        cls: 'local-ai-tag-confidence',
      });

      tagEl.onclick = () => {
        if (this.selectedTags.has(suggestion.tag)) {
          this.selectedTags.delete(suggestion.tag);
          tagEl.removeClass('selected');
        } else {
          this.selectedTags.add(suggestion.tag);
          tagEl.addClass('selected');
        }
      };

      // Auto-select high confidence tags
      if (suggestion.confidence >= 0.7) {
        this.selectedTags.add(suggestion.tag);
        tagEl.addClass('selected');
      }
    }

    const buttonContainer = contentEl.createDiv({ cls: 'local-ai-modal-actions' });

    buttonContainer.createEl('button', { text: 'Cancel' }).onclick = () => this.close();

    const applyBtn = buttonContainer.createEl('button', {
      text: 'Apply Selected',
      cls: 'mod-cta',
    });
    applyBtn.onclick = () => {
      this.onSubmit(Array.from(this.selectedTags));
      this.close();
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SimilarNotesModal extends Modal {
  private results: any[];

  constructor(app: App, results: any[]) {
    super(app);
    this.results = results;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Similar Notes' });

    const list = contentEl.createEl('ul');

    for (const result of this.results) {
      const li = list.createEl('li');
      const link = li.createEl('a', { text: result.document.title });
      link.onclick = () => {
        this.app.workspace.openLinkText(result.document.path, '');
        this.close();
      };
      li.createEl('small', {
        text: ` (${Math.round(result.score * 100)}% similar)`,
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class LinkSuggestionsModal extends Modal {
  private suggestions: any[];

  constructor(app: App, suggestions: any[]) {
    super(app);
    this.suggestions = suggestions;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Suggested Links' });

    const list = contentEl.createEl('ul');

    for (const suggestion of this.suggestions) {
      const li = list.createEl('li');
      const link = li.createEl('a', {
        text: suggestion.toPath.split('/').pop()?.replace('.md', ''),
      });
      link.onclick = () => {
        this.app.workspace.openLinkText(suggestion.toPath, '');
        this.close();
      };
      li.createEl('br');
      li.createEl('small', { text: suggestion.reason });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class FormatPickerModal extends Modal {
  private onSelect: (format: string) => void;

  constructor(app: App, onSelect: (format: string) => void) {
    super(app);
    this.onSelect = onSelect;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Convert To' });

    const formats = [
      { id: 'table', name: 'Table', icon: '📊' },
      { id: 'bullets', name: 'Bullet List', icon: '•' },
      { id: 'numbered', name: 'Numbered List', icon: '1.' },
      { id: 'flowchart', name: 'Flowchart', icon: '🔀' },
      { id: 'mindmap', name: 'Mind Map', icon: '🧠' },
      { id: 'sequence', name: 'Sequence Diagram', icon: '↔️' },
    ];

    const grid = contentEl.createDiv({ cls: 'local-ai-template-grid' });

    for (const format of formats) {
      const card = grid.createDiv({ cls: 'local-ai-template-card' });
      card.createDiv({
        text: `${format.icon} ${format.name}`,
        cls: 'local-ai-template-card-title',
      });
      card.onclick = () => {
        this.onSelect(format.id);
        this.close();
      };
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class OutlineModal extends Modal {
  private outlineGenerator: OutlineGenerator;

  constructor(app: App, outlineGenerator: OutlineGenerator) {
    super(app);
    this.outlineGenerator = outlineGenerator;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Generate Outline' });

    const topicInput = contentEl.createEl('input', {
      type: 'text',
      placeholder: 'Enter topic...',
    });
    topicInput.style.width = '100%';
    topicInput.style.marginBottom = '10px';

    const styleSelect = contentEl.createEl('select');
    styleSelect.style.marginBottom = '10px';
    styleSelect.createEl('option', { value: 'blog', text: 'Blog Style' });
    styleSelect.createEl('option', { value: 'academic', text: 'Academic' });
    styleSelect.createEl('option', { value: 'technical', text: 'Technical' });
    styleSelect.createEl('option', { value: 'creative', text: 'Creative' });

    const resultDiv = contentEl.createDiv();

    const generateBtn = contentEl.createEl('button', {
      text: 'Generate',
      cls: 'mod-cta',
    });

    generateBtn.onclick = async () => {
      const topic = topicInput.value.trim();
      if (!topic) return;

      generateBtn.disabled = true;
      generateBtn.setText('Generating...');

      try {
        const outline = await this.outlineGenerator.generateOutline(topic, {
          style: styleSelect.value as any,
        });

        resultDiv.empty();
        resultDiv.createEl('pre', { text: outline });

        // Add copy and insert buttons
        const btnContainer = resultDiv.createDiv({ cls: 'local-ai-modal-actions' });

        btnContainer.createEl('button', { text: 'Copy' }).onclick = () => {
          navigator.clipboard.writeText(outline);
          new Notice('Copied!');
        };

        btnContainer.createEl('button', { text: 'Insert', cls: 'mod-cta' }).onclick = () => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view) {
            view.editor.replaceSelection(outline);
          }
          this.close();
        };
      } catch (error) {
        new Notice(`Error: ${(error as Error).message}`);
      } finally {
        generateBtn.disabled = false;
        generateBtn.setText('Generate');
      }
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SearchModal extends Modal {
  private ragSearch: RAGSearch;
  private smartQA: SmartQA;

  constructor(app: App, ragSearch: RAGSearch, smartQA: SmartQA) {
    super(app);
    this.ragSearch = ragSearch;
    this.smartQA = smartQA;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Semantic Search' });

    const searchInput = contentEl.createEl('input', {
      type: 'text',
      placeholder: 'Search your notes with natural language...',
    });
    searchInput.style.width = '100%';
    searchInput.style.marginBottom = '10px';

    const resultDiv = contentEl.createDiv();

    searchInput.onkeydown = async (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (!query) return;

        resultDiv.empty();
        resultDiv.createDiv({
          text: 'Searching...',
          cls: 'local-ai-loading',
        });

        try {
          const response = await this.smartQA.askQuestion(query);

          resultDiv.empty();

          resultDiv.createEl('h4', { text: 'Answer' });
          resultDiv.createEl('p', { text: response.answer });

          if (response.sources.length > 0) {
            resultDiv.createEl('h4', { text: 'Sources' });
            const sourceList = resultDiv.createEl('ul');

            for (const source of response.sources) {
              const li = sourceList.createEl('li');
              const link = li.createEl('a', { text: source.title });
              link.onclick = () => {
                this.app.workspace.openLinkText(source.path, '');
              };
            }
          }
        } catch (error) {
          resultDiv.empty();
          resultDiv.createEl('p', {
            text: `Error: ${(error as Error).message}`,
            cls: 'local-ai-chat-error',
          });
        }
      }
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class TemplatePickerModal extends Modal {
  private templates: AITemplates;
  private onResult: (result: string) => void;

  constructor(app: App, templates: AITemplates, onResult: (result: string) => void) {
    super(app);
    this.templates = templates;
    this.onResult = onResult;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'AI Templates' });

    const allTemplates = this.templates.getAllTemplates();
    const grid = contentEl.createDiv({ cls: 'local-ai-template-grid' });

    for (const template of allTemplates) {
      const card = grid.createDiv({ cls: 'local-ai-template-card' });
      card.createDiv({ text: template.name, cls: 'local-ai-template-card-title' });
      card.createDiv({ text: template.description, cls: 'local-ai-template-card-description' });

      card.onclick = () => {
        this.showTemplateForm(template);
      };
    }
  }

  private showTemplateForm(template: any) {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: template.name });
    contentEl.createEl('p', { text: template.description });

    const variables: Record<string, string> = {};
    const inputs: HTMLInputElement[] = [];

    for (const variable of template.variables) {
      const label = contentEl.createEl('label', { text: variable });
      const input = contentEl.createEl('input', { type: 'text' });
      input.style.width = '100%';
      input.style.marginBottom = '10px';
      inputs.push(input);
      variables[variable] = '';

      input.oninput = () => {
        variables[variable] = input.value;
      };
    }

    const btnContainer = contentEl.createDiv({ cls: 'local-ai-modal-actions' });

    btnContainer.createEl('button', { text: 'Back' }).onclick = () => {
      this.onClose();
      this.onOpen();
    };

    const generateBtn = btnContainer.createEl('button', {
      text: 'Generate',
      cls: 'mod-cta',
    });

    generateBtn.onclick = async () => {
      generateBtn.disabled = true;
      generateBtn.setText('Generating...');

      try {
        const result = await this.templates.executeTemplate(template.id, variables);
        this.onResult(result);
        this.close();
      } catch (error) {
        new Notice(`Error: ${(error as Error).message}`);
        generateBtn.disabled = false;
        generateBtn.setText('Generate');
      }
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class CustomPromptModal extends Modal {
  private aiService: AIService;
  private onResult: (result: string) => void;
  private selectedText: string;

  constructor(
    app: App,
    aiService: AIService,
    onResult: (result: string) => void,
    selectedText?: string
  ) {
    super(app);
    this.aiService = aiService;
    this.onResult = onResult;
    this.selectedText = selectedText || '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Custom AI Prompt' });

    if (this.selectedText) {
      contentEl.createEl('p', {
        text: `Selected text: "${this.selectedText.slice(0, 100)}${this.selectedText.length > 100 ? '...' : ''}"`,
      });
    }

    const promptInput = contentEl.createEl('textarea', {
      placeholder: 'Enter your prompt...',
    });
    promptInput.style.width = '100%';
    promptInput.style.height = '100px';
    promptInput.style.marginBottom = '10px';

    const resultDiv = contentEl.createDiv();

    const btnContainer = contentEl.createDiv({ cls: 'local-ai-modal-actions' });

    const generateBtn = btnContainer.createEl('button', {
      text: 'Generate',
      cls: 'mod-cta',
    });

    generateBtn.onclick = async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) return;

      generateBtn.disabled = true;
      generateBtn.setText('Processing...');

      try {
        const fullPrompt = this.selectedText
          ? `${prompt}\n\nText:\n${this.selectedText}`
          : prompt;

        const response = await this.aiService.chat([
          { role: 'user', content: fullPrompt },
        ]);

        resultDiv.empty();
        resultDiv.createEl('h4', { text: 'Result' });
        resultDiv.createEl('pre', { text: response.content });

        const resultBtns = resultDiv.createDiv({ cls: 'local-ai-modal-actions' });

        resultBtns.createEl('button', { text: 'Copy' }).onclick = () => {
          navigator.clipboard.writeText(response.content);
          new Notice('Copied!');
        };

        resultBtns.createEl('button', { text: 'Insert', cls: 'mod-cta' }).onclick = () => {
          this.onResult(response.content);
          this.close();
        };
      } catch (error) {
        resultDiv.empty();
        resultDiv.createEl('p', {
          text: `Error: ${(error as Error).message}`,
          cls: 'local-ai-chat-error',
        });
      } finally {
        generateBtn.disabled = false;
        generateBtn.setText('Generate');
      }
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class VoiceInputModal extends Modal {
  private voiceInput: VoiceInput;
  private onResult: (text: string) => void;
  private isRecording = false;

  constructor(app: App, voiceInput: VoiceInput, onResult: (text: string) => void) {
    super(app);
    this.voiceInput = voiceInput;
    this.onResult = onResult;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Voice Input' });

    const statusDiv = contentEl.createDiv({ text: 'Click to start recording' });

    const recordBtn = contentEl.createEl('button', {
      text: '🎤 Start Recording',
      cls: 'local-ai-voice-btn',
    });
    recordBtn.style.width = '200px';
    recordBtn.style.height = '60px';
    recordBtn.style.fontSize = '18px';
    recordBtn.style.marginTop = '20px';

    const resultDiv = contentEl.createDiv();

    recordBtn.onclick = async () => {
      if (!this.isRecording) {
        try {
          await this.voiceInput.startRecording();
          this.isRecording = true;
          recordBtn.setText('⏹ Stop Recording');
          recordBtn.addClass('recording');
          statusDiv.setText('Recording... Click to stop');
        } catch (error) {
          new Notice(`Error: ${(error as Error).message}`);
        }
      } else {
        try {
          statusDiv.setText('Processing...');
          recordBtn.disabled = true;

          const audioBlob = await this.voiceInput.stopRecording();
          this.isRecording = false;

          const result = await this.voiceInput.transcribe(audioBlob);

          resultDiv.empty();
          resultDiv.createEl('h4', { text: 'Transcription' });
          resultDiv.createEl('p', { text: result.text });

          const resultBtns = resultDiv.createDiv({ cls: 'local-ai-modal-actions' });

          resultBtns.createEl('button', { text: 'Record Again' }).onclick = () => {
            resultDiv.empty();
            statusDiv.setText('Click to start recording');
            recordBtn.setText('🎤 Start Recording');
            recordBtn.removeClass('recording');
            recordBtn.disabled = false;
          };

          resultBtns.createEl('button', { text: 'Insert', cls: 'mod-cta' }).onclick = () => {
            this.onResult(result.text);
            this.close();
          };
        } catch (error) {
          new Notice(`Error: ${(error as Error).message}`);
          recordBtn.setText('🎤 Start Recording');
          recordBtn.removeClass('recording');
          recordBtn.disabled = false;
          statusDiv.setText('Error occurred. Try again.');
        }
      }
    };
  }

  onClose() {
    if (this.isRecording) {
      this.voiceInput.cancelRecording();
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}
