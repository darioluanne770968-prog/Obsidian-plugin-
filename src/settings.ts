import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type LocalAIPlugin from './main';

export type AIProvider = 'ollama' | 'lmstudio' | 'custom';

export interface LocalAISettings {
  // Provider settings
  provider: AIProvider;
  ollamaUrl: string;
  lmStudioUrl: string;
  customApiUrl: string;
  customApiKey: string;

  // Model settings
  model: string;
  embeddingModel: string;
  visionModel: string;
  temperature: number;
  maxTokens: number;

  // Feature toggles
  enableRAG: boolean;
  enableAutoTag: boolean;
  enableAutomation: boolean;
  enableVoice: boolean;

  // RAG settings
  autoIndexOnStartup: boolean;
  excludeFolders: string[];
  chunkSize: number;
  chunkOverlap: number;

  // Voice settings
  whisperUrl: string;

  // UI settings
  showInContextMenu: boolean;
  showInEditorMenu: boolean;
  defaultChatPosition: 'left' | 'right';

  // Automation
  workflows: any[];

  // Custom templates
  customTemplates: any[];
}

export const DEFAULT_SETTINGS: LocalAISettings = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  lmStudioUrl: 'http://localhost:1234',
  customApiUrl: '',
  customApiKey: '',

  model: 'llama3.2',
  embeddingModel: 'nomic-embed-text',
  visionModel: 'llava',
  temperature: 0.7,
  maxTokens: 2048,

  enableRAG: true,
  enableAutoTag: false,
  enableAutomation: false,
  enableVoice: false,

  autoIndexOnStartup: false,
  excludeFolders: ['.obsidian', 'templates'],
  chunkSize: 1000,
  chunkOverlap: 100,

  whisperUrl: 'http://localhost:8080/inference',

  showInContextMenu: true,
  showInEditorMenu: true,
  defaultChatPosition: 'right',

  workflows: [],
  customTemplates: [],
};

export class LocalAISettingTab extends PluginSettingTab {
  plugin: LocalAIPlugin;

  constructor(app: App, plugin: LocalAIPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h1', { text: 'Local AI Assistant Settings' });

    // Connection Settings
    this.createConnectionSettings(containerEl);

    // Model Settings
    this.createModelSettings(containerEl);

    // Feature Settings
    this.createFeatureSettings(containerEl);

    // RAG Settings
    this.createRAGSettings(containerEl);

    // Voice Settings
    this.createVoiceSettings(containerEl);

    // UI Settings
    this.createUISettings(containerEl);
  }

  private createConnectionSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Connection Settings' });

    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select your local AI provider')
      .addDropdown(dropdown => dropdown
        .addOption('ollama', 'Ollama')
        .addOption('lmstudio', 'LM Studio')
        .addOption('custom', 'Custom OpenAI-compatible API')
        .setValue(this.plugin.settings.provider)
        .onChange(async (value: AIProvider) => {
          this.plugin.settings.provider = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.provider === 'ollama') {
      new Setting(containerEl)
        .setName('Ollama URL')
        .setDesc('URL of your Ollama server')
        .addText(text => text
          .setPlaceholder('http://localhost:11434')
          .setValue(this.plugin.settings.ollamaUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollamaUrl = value;
            await this.plugin.saveSettings();
          }));
    }

    if (this.plugin.settings.provider === 'lmstudio') {
      new Setting(containerEl)
        .setName('LM Studio URL')
        .setDesc('URL of your LM Studio server')
        .addText(text => text
          .setPlaceholder('http://localhost:1234')
          .setValue(this.plugin.settings.lmStudioUrl)
          .onChange(async (value) => {
            this.plugin.settings.lmStudioUrl = value;
            await this.plugin.saveSettings();
          }));
    }

    if (this.plugin.settings.provider === 'custom') {
      new Setting(containerEl)
        .setName('Custom API URL')
        .setDesc('URL of your OpenAI-compatible API')
        .addText(text => text
          .setPlaceholder('http://localhost:8080/v1')
          .setValue(this.plugin.settings.customApiUrl)
          .onChange(async (value) => {
            this.plugin.settings.customApiUrl = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('API Key')
        .setDesc('API key (if required)')
        .addText(text => text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.customApiKey)
          .onChange(async (value) => {
            this.plugin.settings.customApiKey = value;
            await this.plugin.saveSettings();
          }));
    }

    // Test connection button
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test your AI provider connection')
      .addButton(button => button
        .setButtonText('Test')
        .setCta()
        .onClick(async () => {
          button.setButtonText('Testing...');
          button.setDisabled(true);

          try {
            const result = await this.plugin.aiService.testConnection();
            if (result.success) {
              new Notice(`✅ ${result.message}`);
            } else {
              new Notice(`❌ ${result.message}`);
            }
          } catch (error) {
            new Notice(`❌ Connection failed: ${(error as Error).message}`);
          } finally {
            button.setButtonText('Test');
            button.setDisabled(false);
          }
        }));
  }

  private createModelSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Model Settings' });

    new Setting(containerEl)
      .setName('Chat Model')
      .setDesc('Model to use for chat and text generation')
      .addText(text => text
        .setPlaceholder('llama3.2')
        .setValue(this.plugin.settings.model)
        .onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Embedding Model')
      .setDesc('Model for generating embeddings (RAG search)')
      .addText(text => text
        .setPlaceholder('nomic-embed-text')
        .setValue(this.plugin.settings.embeddingModel)
        .onChange(async (value) => {
          this.plugin.settings.embeddingModel = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Vision Model')
      .setDesc('Model for image analysis (OCR, image description)')
      .addText(text => text
        .setPlaceholder('llava')
        .setValue(this.plugin.settings.visionModel)
        .onChange(async (value) => {
          this.plugin.settings.visionModel = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('Controls randomness (0 = focused, 1 = creative)')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.1)
        .setValue(this.plugin.settings.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.temperature = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Max Tokens')
      .setDesc('Maximum length of generated responses')
      .addText(text => text
        .setPlaceholder('2048')
        .setValue(String(this.plugin.settings.maxTokens))
        .onChange(async (value) => {
          this.plugin.settings.maxTokens = parseInt(value) || 2048;
          await this.plugin.saveSettings();
        }));
  }

  private createFeatureSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Features' });

    new Setting(containerEl)
      .setName('Enable RAG Search')
      .setDesc('Use your notes as context for AI responses')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableRAG)
        .onChange(async (value) => {
          this.plugin.settings.enableRAG = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Auto-Tagging')
      .setDesc('Automatically suggest tags for new notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAutoTag)
        .onChange(async (value) => {
          this.plugin.settings.enableAutoTag = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Automation Workflows')
      .setDesc('Run automated AI workflows on notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAutomation)
        .onChange(async (value) => {
          this.plugin.settings.enableAutomation = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Voice Input')
      .setDesc('Use voice-to-text for note creation')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableVoice)
        .onChange(async (value) => {
          this.plugin.settings.enableVoice = value;
          await this.plugin.saveSettings();
        }));
  }

  private createRAGSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'RAG Search Settings' });

    new Setting(containerEl)
      .setName('Auto-index on Startup')
      .setDesc('Automatically index notes when Obsidian starts')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoIndexOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.autoIndexOnStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Excluded Folders')
      .setDesc('Folders to exclude from indexing (comma-separated)')
      .addText(text => text
        .setPlaceholder('.obsidian, templates')
        .setValue(this.plugin.settings.excludeFolders.join(', '))
        .onChange(async (value) => {
          this.plugin.settings.excludeFolders = value
            .split(',')
            .map(f => f.trim())
            .filter(f => f);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Index All Notes')
      .setDesc('Build search index for all notes (may take a while)')
      .addButton(button => button
        .setButtonText('Start Indexing')
        .onClick(async () => {
          button.setButtonText('Indexing...');
          button.setDisabled(true);

          try {
            if (this.plugin.ragSearch) {
              await this.plugin.ragSearch.indexAllNotes((current, total) => {
                button.setButtonText(`Indexing ${current}/${total}...`);
              });
              new Notice(`✅ Indexed ${this.plugin.ragSearch.getIndexedCount()} notes`);
            }
          } catch (error) {
            new Notice(`❌ Indexing failed: ${(error as Error).message}`);
          } finally {
            button.setButtonText('Start Indexing');
            button.setDisabled(false);
          }
        }));
  }

  private createVoiceSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Voice Input Settings' });

    new Setting(containerEl)
      .setName('Whisper API URL')
      .setDesc('URL of your local Whisper server')
      .addText(text => text
        .setPlaceholder('http://localhost:8080/inference')
        .setValue(this.plugin.settings.whisperUrl)
        .onChange(async (value) => {
          this.plugin.settings.whisperUrl = value;
          await this.plugin.saveSettings();
        }));
  }

  private createUISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'UI Settings' });

    new Setting(containerEl)
      .setName('Show in Context Menu')
      .setDesc('Show AI actions in right-click menu')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showInContextMenu)
        .onChange(async (value) => {
          this.plugin.settings.showInContextMenu = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show in Editor Menu')
      .setDesc('Show AI actions in editor menu')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showInEditorMenu)
        .onChange(async (value) => {
          this.plugin.settings.showInEditorMenu = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default Chat Position')
      .setDesc('Where to open the AI chat panel')
      .addDropdown(dropdown => dropdown
        .addOption('left', 'Left sidebar')
        .addOption('right', 'Right sidebar')
        .setValue(this.plugin.settings.defaultChatPosition)
        .onChange(async (value: 'left' | 'right') => {
          this.plugin.settings.defaultChatPosition = value;
          await this.plugin.saveSettings();
        }));
  }
}
