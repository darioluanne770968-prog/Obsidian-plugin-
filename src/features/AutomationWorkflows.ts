import { TFile, TFolder, Vault, MetadataCache, TAbstractFile } from 'obsidian';
import { AIService } from '../services/AIService';
import { NoteSummarizer } from './NoteSummarizer';
import { AutoTagger } from './AutoTagger';
import { TaskExtractor } from './TaskExtractor';

export interface WorkflowTrigger {
  type: 'file_created' | 'file_modified' | 'folder_watch' | 'schedule' | 'manual';
  config: {
    folder?: string;
    pattern?: string;
    schedule?: string; // cron-like
    delay?: number; // ms to wait after trigger
  };
}

export interface WorkflowAction {
  type: 'summarize' | 'tag' | 'extract_tasks' | 'generate_title' | 'custom_prompt' | 'move_file' | 'append_content';
  config: {
    prompt?: string;
    targetFolder?: string;
    appendTemplate?: string;
    position?: 'top' | 'bottom';
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
}

export class AutomationWorkflows {
  private aiService: AIService;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private workflows: Workflow[] = [];
  private summarizer: NoteSummarizer;
  private tagger: AutoTagger;
  private taskExtractor: TaskExtractor;
  private watchedFolders: Map<string, () => void> = new Map();
  private processingQueue: Set<string> = new Set();

  constructor(
    aiService: AIService,
    vault: Vault,
    metadataCache: MetadataCache
  ) {
    this.aiService = aiService;
    this.vault = vault;
    this.metadataCache = metadataCache;
    this.summarizer = new NoteSummarizer(aiService);
    this.tagger = new AutoTagger(aiService, vault, metadataCache);
    this.taskExtractor = new TaskExtractor(aiService);
  }

  addWorkflow(workflow: Workflow): void {
    this.workflows.push(workflow);
    if (workflow.enabled && workflow.trigger.type === 'folder_watch') {
      this.setupFolderWatch(workflow);
    }
  }

  removeWorkflow(id: string): void {
    const index = this.workflows.findIndex(w => w.id === id);
    if (index !== -1) {
      const workflow = this.workflows[index];
      if (workflow.trigger.type === 'folder_watch') {
        this.teardownFolderWatch(workflow);
      }
      this.workflows.splice(index, 1);
    }
  }

  toggleWorkflow(id: string, enabled: boolean): void {
    const workflow = this.workflows.find(w => w.id === id);
    if (workflow) {
      workflow.enabled = enabled;
      if (workflow.trigger.type === 'folder_watch') {
        if (enabled) {
          this.setupFolderWatch(workflow);
        } else {
          this.teardownFolderWatch(workflow);
        }
      }
    }
  }

  private setupFolderWatch(workflow: Workflow): void {
    // Note: Actual file watching is done via Obsidian's vault events
    // This is a placeholder for the folder configuration
    if (workflow.trigger.config.folder) {
      this.watchedFolders.set(workflow.id, () => {});
    }
  }

  private teardownFolderWatch(workflow: Workflow): void {
    this.watchedFolders.delete(workflow.id);
  }

  async handleFileCreated(file: TFile): Promise<void> {
    if (!file.extension.match(/^(md|markdown)$/i)) return;
    if (this.processingQueue.has(file.path)) return;

    const matchingWorkflows = this.workflows.filter(
      w => w.enabled &&
        (w.trigger.type === 'file_created' || w.trigger.type === 'folder_watch') &&
        this.matchesPattern(file.path, w.trigger.config)
    );

    for (const workflow of matchingWorkflows) {
      await this.executeWorkflow(workflow, file);
    }
  }

  async handleFileModified(file: TFile): Promise<void> {
    if (!file.extension.match(/^(md|markdown)$/i)) return;
    if (this.processingQueue.has(file.path)) return;

    const matchingWorkflows = this.workflows.filter(
      w => w.enabled &&
        w.trigger.type === 'file_modified' &&
        this.matchesPattern(file.path, w.trigger.config)
    );

    for (const workflow of matchingWorkflows) {
      await this.executeWorkflow(workflow, file);
    }
  }

  private matchesPattern(filePath: string, config: WorkflowTrigger['config']): boolean {
    if (config.folder) {
      if (!filePath.startsWith(config.folder)) return false;
    }

    if (config.pattern) {
      const regex = new RegExp(config.pattern);
      if (!regex.test(filePath)) return false;
    }

    return true;
  }

  async executeWorkflow(workflow: Workflow, file: TFile): Promise<void> {
    this.processingQueue.add(file.path);

    try {
      // Wait for configured delay
      if (workflow.trigger.config.delay) {
        await new Promise(resolve => setTimeout(resolve, workflow.trigger.config.delay));
      }

      // Execute each action in sequence
      for (const action of workflow.actions) {
        await this.executeAction(action, file);
      }
    } catch (error) {
      console.error(`Workflow ${workflow.name} failed:`, error);
    } finally {
      this.processingQueue.delete(file.path);
    }
  }

  private async executeAction(action: WorkflowAction, file: TFile): Promise<void> {
    const content = await this.vault.cachedRead(file);

    switch (action.type) {
      case 'summarize': {
        const summary = await this.summarizer.generateTLDR(content);
        await this.prependToFile(file, `> [!summary] AI Summary\n> ${summary}\n\n`);
        break;
      }

      case 'tag': {
        const suggestions = await this.tagger.suggestTags(content, 5);
        const tags = suggestions
          .filter(s => s.confidence >= 0.6)
          .map(s => s.tag);
        if (tags.length > 0) {
          await this.tagger.applyTags(file, tags);
        }
        break;
      }

      case 'extract_tasks': {
        const tasks = await this.taskExtractor.extractTasks(content);
        if (tasks.length > 0) {
          const taskMd = this.taskExtractor.formatTasksAsMarkdown(tasks);
          await this.appendToFile(file, `\n\n${taskMd}`);
        }
        break;
      }

      case 'generate_title': {
        const title = await this.summarizer.generateTitle(content);
        // Rename file with new title
        const newPath = file.path.replace(file.basename, title.replace(/[\\/:*?"<>|]/g, '-'));
        if (newPath !== file.path) {
          await this.vault.rename(file, newPath);
        }
        break;
      }

      case 'custom_prompt': {
        if (action.config.prompt) {
          const messages = [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: `${action.config.prompt}\n\nNote content:\n${content}` },
          ];
          const response = await this.aiService.chat(messages);

          if (action.config.position === 'top') {
            await this.prependToFile(file, response.content + '\n\n');
          } else {
            await this.appendToFile(file, '\n\n' + response.content);
          }
        }
        break;
      }

      case 'move_file': {
        if (action.config.targetFolder) {
          const targetPath = `${action.config.targetFolder}/${file.name}`;
          // Create folder if needed
          const folder = this.vault.getAbstractFileByPath(action.config.targetFolder);
          if (!folder) {
            await this.vault.createFolder(action.config.targetFolder);
          }
          await this.vault.rename(file, targetPath);
        }
        break;
      }

      case 'append_content': {
        if (action.config.appendTemplate) {
          const processedTemplate = this.processTemplate(action.config.appendTemplate, file);
          if (action.config.position === 'top') {
            await this.prependToFile(file, processedTemplate + '\n\n');
          } else {
            await this.appendToFile(file, '\n\n' + processedTemplate);
          }
        }
        break;
      }
    }
  }

  private processTemplate(template: string, file: TFile): string {
    const now = new Date();
    return template
      .replace(/{{date}}/g, now.toISOString().split('T')[0])
      .replace(/{{time}}/g, now.toTimeString().split(' ')[0])
      .replace(/{{filename}}/g, file.basename)
      .replace(/{{filepath}}/g, file.path);
  }

  private async prependToFile(file: TFile, content: string): Promise<void> {
    const existingContent = await this.vault.read(file);

    // Handle frontmatter
    if (existingContent.startsWith('---')) {
      const frontmatterEnd = existingContent.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        const frontmatter = existingContent.slice(0, frontmatterEnd + 3);
        const body = existingContent.slice(frontmatterEnd + 3);
        await this.vault.modify(file, frontmatter + '\n\n' + content + body);
        return;
      }
    }

    await this.vault.modify(file, content + existingContent);
  }

  private async appendToFile(file: TFile, content: string): Promise<void> {
    const existingContent = await this.vault.read(file);
    await this.vault.modify(file, existingContent + content);
  }

  getWorkflows(): Workflow[] {
    return [...this.workflows];
  }

  setWorkflows(workflows: Workflow[]): void {
    // Teardown existing watches
    for (const workflow of this.workflows) {
      if (workflow.trigger.type === 'folder_watch') {
        this.teardownFolderWatch(workflow);
      }
    }

    this.workflows = workflows;

    // Setup new watches
    for (const workflow of workflows) {
      if (workflow.enabled && workflow.trigger.type === 'folder_watch') {
        this.setupFolderWatch(workflow);
      }
    }
  }

  static createDefaultWorkflows(): Workflow[] {
    return [
      {
        id: 'auto-summarize-inbox',
        name: 'Auto-summarize Inbox Notes',
        description: 'Automatically add a summary to new notes in the Inbox folder',
        enabled: false,
        trigger: {
          type: 'folder_watch',
          config: { folder: 'Inbox', delay: 1000 },
        },
        actions: [{ type: 'summarize', config: {} }],
      },
      {
        id: 'auto-tag-new-notes',
        name: 'Auto-tag New Notes',
        description: 'Automatically add relevant tags to new notes',
        enabled: false,
        trigger: {
          type: 'file_created',
          config: { delay: 500 },
        },
        actions: [{ type: 'tag', config: {} }],
      },
      {
        id: 'meeting-notes-processor',
        name: 'Process Meeting Notes',
        description: 'Extract action items from notes in the Meetings folder',
        enabled: false,
        trigger: {
          type: 'folder_watch',
          config: { folder: 'Meetings', pattern: '\\.md$' },
        },
        actions: [
          { type: 'extract_tasks', config: {} },
          { type: 'tag', config: {} },
        ],
      },
    ];
  }
}
