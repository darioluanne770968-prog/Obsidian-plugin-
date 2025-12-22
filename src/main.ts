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

// Advanced Features
import { ResearchAgent } from './features/ResearchAgent';
import { AIPersonas } from './features/AIPersonas';
import { SecondBrainAnalytics } from './features/SecondBrainAnalytics';
import { SmartConnections } from './features/SmartConnections';
import { LearningAssistant } from './features/LearningAssistant';
import { PDFProcessor } from './features/PDFProcessor';
import { TimeTravel } from './features/TimeTravel';

// Super Advanced Features
import { AIMemory } from './features/AIMemory';
import { CreativeEngine } from './features/CreativeEngine';
import { MetaCognition } from './features/MetaCognition';
import { Gamification } from './features/Gamification';
import { DailyBriefing } from './features/DailyBriefing';

// New Features
import { DreamJournalAnalyzer } from './features/DreamJournalAnalyzer';
import { MeetingAssistant } from './features/MeetingAssistant';
import { JournalingCoach } from './features/JournalingCoach';
import { DecisionJournal } from './features/DecisionJournal';
import { RelationshipManager } from './features/RelationshipManager';
import { IdeaIncubator } from './features/IdeaIncubator';
import { WritingAnalytics } from './features/WritingAnalytics';
import { NoteQualityScorer } from './features/NoteQualityScorer';
import { SmartArchiveAssistant } from './features/SmartArchiveAssistant';

export default class LocalAIPlugin extends Plugin {
  settings: LocalAISettings;

  // Services
  aiService: AIService;
  ragSearch: RAGSearch;
  smartQA: SmartQA;

  // Basic Features
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

  // Advanced Features
  researchAgent: ResearchAgent;
  aiPersonas: AIPersonas;
  secondBrainAnalytics: SecondBrainAnalytics;
  smartConnections: SmartConnections;
  learningAssistant: LearningAssistant;
  pdfProcessor: PDFProcessor;
  timeTravel: TimeTravel;

  // Super Advanced Features
  aiMemory: AIMemory;
  creativeEngine: CreativeEngine;
  metaCognition: MetaCognition;
  gamification: Gamification;
  dailyBriefing: DailyBriefing;

  // New Features
  dreamJournalAnalyzer: DreamJournalAnalyzer;
  meetingAssistant: MeetingAssistant;
  journalingCoach: JournalingCoach;
  decisionJournal: DecisionJournal;
  relationshipManager: RelationshipManager;
  ideaIncubator: IdeaIncubator;
  writingAnalytics: WritingAnalytics;
  noteQualityScorer: NoteQualityScorer;
  smartArchiveAssistant: SmartArchiveAssistant;

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
    // Basic Features
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

    // Advanced Features
    this.researchAgent = new ResearchAgent(this.aiService, this.ragSearch, this.app.vault);
    this.aiPersonas = new AIPersonas(this.aiService);
    this.secondBrainAnalytics = new SecondBrainAnalytics(this.aiService, this.app.vault, this.app.metadataCache);
    this.smartConnections = new SmartConnections(this.aiService, this.ragSearch, this.app.vault);
    this.learningAssistant = new LearningAssistant(this.aiService, this.app.vault);
    this.pdfProcessor = new PDFProcessor(this.aiService, this.app.vault);
    this.timeTravel = new TimeTravel(this.aiService, this.app.vault);

    // Super Advanced Features
    this.aiMemory = new AIMemory(this.aiService, this.app.vault);
    this.creativeEngine = new CreativeEngine(this.aiService, this.ragSearch, this.app.vault);
    this.metaCognition = new MetaCognition(this.aiService);
    this.gamification = new Gamification(this.aiService, this.app.vault);
    this.dailyBriefing = new DailyBriefing(this.aiService, this.app.vault, this.app.metadataCache);

    // New Features
    this.dreamJournalAnalyzer = new DreamJournalAnalyzer(this.aiService, this.app.vault);
    this.meetingAssistant = new MeetingAssistant(this.aiService, this.app.vault);
    this.journalingCoach = new JournalingCoach(this.aiService);
    this.decisionJournal = new DecisionJournal(this.aiService, this.app.vault);
    this.relationshipManager = new RelationshipManager(this.aiService, this.app.vault);
    this.ideaIncubator = new IdeaIncubator(this.aiService, this.app.vault);
    this.writingAnalytics = new WritingAnalytics(this.aiService, this.app.vault);
    this.noteQualityScorer = new NoteQualityScorer(this.aiService, this.app.vault);
    this.smartArchiveAssistant = new SmartArchiveAssistant(this.aiService, this.app.vault);

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

    // =====================
    // Advanced Feature Commands
    // =====================

    // Research Agent
    this.addCommand({
      id: 'ai-research-topic',
      name: 'AI: Research Topic',
      callback: () => this.showResearchModal(),
    });

    // AI Personas
    this.addCommand({
      id: 'ai-select-persona',
      name: 'AI: Select AI Persona',
      callback: () => this.showPersonaModal(),
    });

    // Second Brain Analytics
    this.addCommand({
      id: 'ai-vault-analytics',
      name: 'AI: Vault Analytics Dashboard',
      callback: () => this.showAnalyticsDashboard(),
    });

    // Smart Connections
    this.addCommand({
      id: 'ai-discover-connections',
      name: 'AI: Discover Hidden Connections',
      callback: () => this.discoverConnections(),
    });

    // Learning Assistant
    this.addCommand({
      id: 'ai-spaced-repetition',
      name: 'AI: Spaced Repetition Review',
      callback: () => this.showSpacedRepetitionModal(),
    });

    this.addCommand({
      id: 'ai-generate-quiz',
      name: 'AI: Generate Quiz',
      callback: () => this.generateQuiz(),
    });

    // PDF Processor
    this.addCommand({
      id: 'ai-analyze-pdf',
      name: 'AI: Analyze PDF',
      callback: () => this.analyzePDF(),
    });

    // Time Travel
    this.addCommand({
      id: 'ai-note-evolution',
      name: 'AI: View Note Evolution',
      callback: () => this.showNoteEvolution(),
    });

    // =====================
    // Super Advanced Feature Commands
    // =====================

    // AI Memory
    this.addCommand({
      id: 'ai-learn-from-notes',
      name: 'AI: Learn From My Notes',
      callback: () => this.learnFromNotes(),
    });

    // Creative Engine
    this.addCommand({
      id: 'ai-scamper',
      name: 'AI: SCAMPER Creative Technique',
      callback: () => this.showSCAMPERModal(),
    });

    this.addCommand({
      id: 'ai-force-connection',
      name: 'AI: Force Random Connection',
      callback: () => this.forceConnection(),
    });

    this.addCommand({
      id: 'ai-six-hats',
      name: 'AI: Six Thinking Hats Analysis',
      callback: () => this.showSixHatsModal(),
    });

    this.addCommand({
      id: 'ai-oblique-strategy',
      name: 'AI: Get Oblique Strategy',
      callback: () => this.showObliqueStrategy(),
    });

    // MetaCognition
    this.addCommand({
      id: 'ai-detect-biases',
      name: 'AI: Detect Cognitive Biases',
      callback: () => this.detectBiases(),
    });

    this.addCommand({
      id: 'ai-analyze-arguments',
      name: 'AI: Analyze Arguments',
      callback: () => this.analyzeArguments(),
    });

    // Gamification
    this.addCommand({
      id: 'ai-show-progress',
      name: 'AI: Show Progress & Achievements',
      callback: () => this.showGamificationModal(),
    });

    this.addCommand({
      id: 'ai-daily-quests',
      name: 'AI: View Daily Quests',
      callback: () => this.showDailyQuests(),
    });

    // Daily Briefing
    this.addCommand({
      id: 'ai-daily-briefing',
      name: 'AI: Generate Daily Briefing',
      callback: () => this.generateDailyBriefing(),
    });

    this.addCommand({
      id: 'ai-weekly-digest',
      name: 'AI: Generate Weekly Digest',
      callback: () => this.generateWeeklyDigest(),
    });

    // =====================
    // New Feature Commands
    // =====================

    // Dream Journal
    this.addCommand({
      id: 'ai-analyze-dream',
      name: 'AI: Analyze Dream Entry',
      callback: () => this.analyzeDream(),
    });

    this.addCommand({
      id: 'ai-dream-patterns',
      name: 'AI: View Dream Patterns',
      callback: () => this.showDreamPatterns(),
    });

    // Meeting Assistant
    this.addCommand({
      id: 'ai-prepare-meeting',
      name: 'AI: Prepare for Meeting',
      callback: () => this.showMeetingPrepModal(),
    });

    this.addCommand({
      id: 'ai-process-meeting-notes',
      name: 'AI: Process Meeting Notes',
      callback: () => this.processMeetingNotes(),
    });

    // Journaling Coach
    this.addCommand({
      id: 'ai-journal-prompt',
      name: 'AI: Get Journaling Prompt',
      callback: () => this.getJournalingPrompt(),
    });

    this.addCommand({
      id: 'ai-morning-pages',
      name: 'AI: Start Morning Pages',
      callback: () => this.startMorningPages(),
    });

    this.addCommand({
      id: 'ai-evening-reflection',
      name: 'AI: Evening Reflection',
      callback: () => this.startEveningReflection(),
    });

    this.addCommand({
      id: 'ai-guided-journaling',
      name: 'AI: Guided Journaling Session',
      callback: () => this.showGuidedJournalingModal(),
    });

    // Decision Journal
    this.addCommand({
      id: 'ai-new-decision',
      name: 'AI: Create New Decision Entry',
      callback: () => this.showNewDecisionModal(),
    });

    this.addCommand({
      id: 'ai-review-decisions',
      name: 'AI: Review Past Decisions',
      callback: () => this.showDecisionReviewModal(),
    });

    this.addCommand({
      id: 'ai-decision-analytics',
      name: 'AI: Decision Analytics',
      callback: () => this.showDecisionAnalytics(),
    });

    // Relationship Manager
    this.addCommand({
      id: 'ai-extract-people',
      name: 'AI: Extract People from Notes',
      callback: () => this.extractPeopleFromNotes(),
    });

    this.addCommand({
      id: 'ai-relationship-insights',
      name: 'AI: Relationship Insights',
      callback: () => this.showRelationshipInsights(),
    });

    this.addCommand({
      id: 'ai-network-analysis',
      name: 'AI: Network Analysis',
      callback: () => this.showNetworkAnalysis(),
    });

    // Idea Incubator
    this.addCommand({
      id: 'ai-capture-idea',
      name: 'AI: Capture New Idea',
      callback: () => this.showCaptureIdeaModal(),
    });

    this.addCommand({
      id: 'ai-incubator-dashboard',
      name: 'AI: Idea Incubator Dashboard',
      callback: () => this.showIdeaIncubatorDashboard(),
    });

    this.addCommand({
      id: 'ai-combine-ideas',
      name: 'AI: Combine Random Ideas',
      callback: () => this.combineRandomIdeas(),
    });

    // Writing Analytics
    this.addCommand({
      id: 'ai-writing-stats',
      name: 'AI: Writing Statistics',
      callback: () => this.showWritingStats(),
    });

    this.addCommand({
      id: 'ai-writing-patterns',
      name: 'AI: Analyze Writing Patterns',
      callback: () => this.analyzeWritingPatterns(),
    });

    // Note Quality
    this.addCommand({
      id: 'ai-score-note',
      name: 'AI: Score Current Note Quality',
      callback: () => this.scoreCurrentNote(),
    });

    this.addCommand({
      id: 'ai-vault-health',
      name: 'AI: Vault Health Report',
      callback: () => this.generateVaultHealthReport(),
    });

    // Smart Archive
    this.addCommand({
      id: 'ai-cleanup-suggestions',
      name: 'AI: Get Cleanup Suggestions',
      callback: () => this.showCleanupSuggestions(),
    });

    this.addCommand({
      id: 'ai-find-duplicates',
      name: 'AI: Find Duplicate Notes',
      callback: () => this.findDuplicateNotes(),
    });

    this.addCommand({
      id: 'ai-archive-candidates',
      name: 'AI: Find Archive Candidates',
      callback: () => this.findArchiveCandidates(),
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

  // =====================
  // Advanced Feature Handlers
  // =====================

  private showResearchModal() {
    new Notice('Research Agent: Enter a topic to research');
    // Implementation for research modal
  }

  private showPersonaModal() {
    new Notice('Select an AI Persona for your conversation');
    // Implementation for persona selection
  }

  private async showAnalyticsDashboard() {
    new Notice('Generating analytics...');
    try {
      const analytics = await this.secondBrainAnalytics.generateFullAnalysis();
      const markdown = this.secondBrainAnalytics.formatAnalysisAsMarkdown(analytics);
      await this.app.vault.create('AI Analytics Dashboard.md', markdown);
      new Notice('Analytics dashboard created!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async discoverConnections() {
    new Notice('Discovering hidden connections...');
    try {
      const connections = await this.smartConnections.discoverHiddenConnections(5);
      if (connections.length > 0) {
        new Notice(`Found ${connections.length} hidden connections!`);
      } else {
        new Notice('No hidden connections found. Try indexing more notes.');
      }
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private showSpacedRepetitionModal() {
    new Notice('Loading spaced repetition cards...');
    // Implementation for spaced repetition
  }

  private async generateQuiz() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }
    new Notice('Generating quiz...');
    try {
      const content = await this.app.vault.read(file);
      const quiz = await this.learningAssistant.generateQuiz(content, 5);
      const quizPath = file.path.replace('.md', ' - Quiz.md');
      await this.app.vault.create(quizPath, this.learningAssistant.formatQuizAsMarkdown(quiz));
      new Notice('Quiz created!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private analyzePDF() {
    new Notice('PDF analysis: Select a PDF file');
    // Implementation for PDF analysis
  }

  private async showNoteEvolution() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }
    new Notice('Analyzing note evolution...');
    // Implementation for note evolution view
  }

  // =====================
  // Super Advanced Feature Handlers
  // =====================

  private async learnFromNotes() {
    new Notice('Learning from your notes...');
    try {
      await this.aiMemory.learnFromNotes(50);
      new Notice('AI has learned from your writing patterns!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private showSCAMPERModal() {
    new Notice('Enter a concept for SCAMPER analysis');
    // Implementation for SCAMPER modal
  }

  private async forceConnection() {
    new Notice('Creating forced connection between random notes...');
    try {
      const connection = await this.creativeEngine.forceConnection();
      const markdown = `# Forced Connection\n\n## ${connection.concept1} ↔ ${connection.concept2}\n\n${connection.connections.map(c => `### ${c.type}\n${c.explanation}\n\n**New Idea:** ${c.newIdea}`).join('\n\n')}\n\n## Combined Insight\n${connection.combinedInsight}`;
      await this.app.vault.create(`Forced Connection - ${Date.now()}.md`, markdown);
      new Notice('Forced connection created!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private showSixHatsModal() {
    new Notice('Enter a problem for Six Thinking Hats analysis');
    // Implementation for Six Hats modal
  }

  private async showObliqueStrategy() {
    try {
      const strategy = await this.creativeEngine.obliqueStrategy();
      new Notice(`Strategy: "${strategy.strategy}"\n\n${strategy.interpretation}`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async detectBiases() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }
    new Notice('Detecting cognitive biases...');
    try {
      const content = await this.app.vault.read(file);
      const analysis = await this.metaCognition.detectBiases(content);
      if (analysis.detectedBiases.length > 0) {
        new Notice(`Found ${analysis.detectedBiases.length} potential biases`);
      } else {
        new Notice('No significant biases detected');
      }
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async analyzeArguments() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }
    new Notice('Analyzing arguments...');
    try {
      const content = await this.app.vault.read(file);
      const analysis = await this.metaCognition.analyzeArgument(content);
      new Notice(`Found ${analysis.premises.length} premises supporting ${analysis.conclusions.length} conclusions`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async showGamificationModal() {
    new Notice('Loading progress...');
    try {
      const profile = this.gamification.getUserProfile();
      new Notice(`Level ${profile.level} | ${profile.currentXP}/${profile.xpToNextLevel} XP`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async showDailyQuests() {
    new Notice('Loading daily quests...');
    try {
      const quests = this.gamification.getDailyQuests();
      new Notice(`${quests.filter(q => q.progress >= q.target).length}/${quests.length} quests completed today`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async generateDailyBriefing() {
    new Notice('Generating daily briefing...');
    try {
      const briefing = await this.dailyBriefing.generateDailyBriefing();
      const markdown = this.dailyBriefing.formatBriefingAsMarkdown(briefing);
      await this.app.vault.create(`Daily Briefing - ${new Date().toISOString().split('T')[0]}.md`, markdown);
      new Notice('Daily briefing created!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async generateWeeklyDigest() {
    new Notice('Generating weekly digest...');
    try {
      const digest = await this.dailyBriefing.generateWeeklyDigest();
      const markdown = this.dailyBriefing.formatDigestAsMarkdown(digest);
      await this.app.vault.create(`Weekly Digest - ${new Date().toISOString().split('T')[0]}.md`, markdown);
      new Notice('Weekly digest created!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  // =====================
  // New Feature Handlers
  // =====================

  private async analyzeDream() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }
    new Notice('Analyzing dream...');
    try {
      const content = await this.app.vault.read(file);
      const analysis = await this.dreamJournalAnalyzer.analyzeDream(content);
      const summary = `Mood: ${analysis.interpretation}\nSymbols: ${analysis.symbols.join(', ')}\nThemes: ${analysis.themes.join(', ')}`;
      new Notice(summary);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async showDreamPatterns() {
    new Notice('Analyzing dream patterns...');
    try {
      const patterns = await this.dreamJournalAnalyzer.findPatterns();
      if (patterns.length > 0) {
        new Notice(`Found ${patterns.length} recurring patterns in your dreams`);
      } else {
        new Notice('Record more dreams to see patterns');
      }
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private showMeetingPrepModal() {
    new Notice('Meeting Prep: Enter meeting details');
    // Implementation for meeting prep modal
  }

  private async processMeetingNotes() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }
    new Notice('Processing meeting notes...');
    try {
      const content = await this.app.vault.read(file);
      const notes = await this.meetingAssistant.processRawNotes(content, file.basename);
      const markdown = this.meetingAssistant.formatMeetingNotesAsMarkdown(notes);
      await this.app.vault.modify(file, markdown);
      new Notice('Meeting notes processed!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async getJournalingPrompt() {
    try {
      const prompt = await this.journalingCoach.generatePrompt();
      new Notice(`Journal Prompt: ${prompt.prompt}`);
      this.insertAtCursor(`\n\n> ${prompt.prompt}\n\n`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async startMorningPages() {
    try {
      const prompts = await this.journalingCoach.generateMorningPages();
      const content = `# Morning Pages - ${new Date().toISOString().split('T')[0]}\n\n${prompts.map(p => `## ${p}\n\n`).join('')}`;
      await this.app.vault.create(`Morning Pages - ${new Date().toISOString().split('T')[0]}.md`, content);
      new Notice('Morning pages template created!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async startEveningReflection() {
    try {
      const prompts = await this.journalingCoach.generateEveningReflection();
      const content = `# Evening Reflection - ${new Date().toISOString().split('T')[0]}\n\n${prompts.map(p => `## ${p}\n\n`).join('')}`;
      await this.app.vault.create(`Evening Reflection - ${new Date().toISOString().split('T')[0]}.md`, content);
      new Notice('Evening reflection template created!');
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private showGuidedJournalingModal() {
    new Notice('Select a journaling topic');
    // Implementation for guided journaling modal
  }

  private showNewDecisionModal() {
    new Notice('Enter decision details');
    // Implementation for new decision modal
  }

  private showDecisionReviewModal() {
    new Notice('Loading decisions for review...');
    // Implementation for decision review modal
  }

  private async showDecisionAnalytics() {
    new Notice('Generating decision analytics...');
    try {
      const analytics = await this.decisionJournal.generateAnalytics();
      new Notice(`${analytics.totalDecisions} decisions tracked | ${Math.round(analytics.accuracyRate * 100)}% accuracy`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async extractPeopleFromNotes() {
    new Notice('Extracting people from notes...');
    try {
      const people = await this.relationshipManager.extractPeopleFromNotes();
      new Notice(`Found ${people.length} people in your notes`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async showRelationshipInsights() {
    new Notice('Generating relationship insights...');
    try {
      const insights = await this.relationshipManager.getRelationshipInsights();
      if (insights.length > 0) {
        new Notice(`${insights.length} relationship insights available`);
      } else {
        new Notice('No insights available. Add more interactions first.');
      }
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async showNetworkAnalysis() {
    new Notice('Analyzing your network...');
    try {
      const analysis = await this.relationshipManager.generateNetworkAnalysis();
      new Notice(`${analysis.totalContacts} contacts | ${analysis.strongRelationships.length} strong relationships`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private showCaptureIdeaModal() {
    new Notice('Enter your idea');
    // Implementation for idea capture modal
  }

  private async showIdeaIncubatorDashboard() {
    new Notice('Loading idea incubator...');
    try {
      const ideas = this.ideaIncubator.getAllIdeas();
      const highPotential = this.ideaIncubator.getHighPotentialIdeas();
      new Notice(`${ideas.length} ideas | ${highPotential.length} high potential`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async combineRandomIdeas() {
    new Notice('Combining random ideas...');
    try {
      const ideas = this.ideaIncubator.getAllIdeas();
      if (ideas.length < 2) {
        new Notice('Need at least 2 ideas to combine');
        return;
      }
      const idx1 = Math.floor(Math.random() * ideas.length);
      let idx2 = Math.floor(Math.random() * ideas.length);
      while (idx2 === idx1) idx2 = Math.floor(Math.random() * ideas.length);

      const combined = await this.ideaIncubator.combineIdeas(ideas[idx1].id, ideas[idx2].id);
      if (combined) {
        new Notice(`New idea created: ${combined.title}`);
      }
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async showWritingStats() {
    new Notice('Generating writing statistics...');
    try {
      const stats = await this.writingAnalytics.generateFullStats();
      new Notice(`${stats.totalWords.toLocaleString()} words | ${stats.totalNotes} notes | ${stats.writingStreak} day streak`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async analyzeWritingPatterns() {
    new Notice('Analyzing writing patterns...');
    try {
      const patterns = await this.writingAnalytics.analyzeWritingPatterns();
      new Notice(`Most productive: ${patterns.mostProductiveDay} at ${patterns.mostProductiveHour}:00`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async scoreCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note');
      return;
    }
    new Notice('Scoring note quality...');
    try {
      const score = await this.noteQualityScorer.scoreNote(file);
      new Notice(`Grade: ${score.grade} (${score.overall}/100)`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async generateVaultHealthReport() {
    new Notice('Generating vault health report...');
    try {
      const report = await this.noteQualityScorer.generateVaultHealthReport();
      const markdown = this.noteQualityScorer.formatReportAsMarkdown(report);
      await this.app.vault.create(`Vault Health Report - ${new Date().toISOString().split('T')[0]}.md`, markdown);
      new Notice(`Report created! Health score: ${report.healthScore}/100`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async showCleanupSuggestions() {
    new Notice('Generating cleanup suggestions...');
    try {
      const report = await this.smartArchiveAssistant.generateCleanupReport();
      const markdown = this.smartArchiveAssistant.formatReportAsMarkdown(report);
      await this.app.vault.create(`Cleanup Report - ${new Date().toISOString().split('T')[0]}.md`, markdown);
      new Notice(`Report created! ${report.archiveCandidates.length} notes to archive`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async findDuplicateNotes() {
    new Notice('Finding duplicate notes...');
    try {
      const duplicates = await this.smartArchiveAssistant.findDuplicates();
      new Notice(`Found ${duplicates.length} duplicate groups`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
  }

  private async findArchiveCandidates() {
    new Notice('Finding archive candidates...');
    try {
      const candidates = await this.smartArchiveAssistant.findArchiveCandidates();
      new Notice(`Found ${candidates.length} notes to consider archiving`);
    } catch (error) {
      new Notice(`Error: ${(error as Error).message}`);
    }
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
