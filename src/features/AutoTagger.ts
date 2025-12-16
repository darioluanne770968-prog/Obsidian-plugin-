import { TFile, Vault, MetadataCache } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

export interface ClassificationResult {
  category: string;
  confidence: number;
  suggestedFolder?: string;
}

export class AutoTagger {
  private aiService: AIService;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private existingTags: Set<string> = new Set();

  constructor(aiService: AIService, vault: Vault, metadataCache: MetadataCache) {
    this.aiService = aiService;
    this.vault = vault;
    this.metadataCache = metadataCache;
    this.loadExistingTags();
  }

  private loadExistingTags(): void {
    // Collect all existing tags from the vault
    const files = this.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = this.metadataCache.getFileCache(file);
      if (cache?.tags) {
        cache.tags.forEach(t => this.existingTags.add(t.tag.replace(/^#/, '')));
      }
      if (cache?.frontmatter?.tags) {
        const tags = cache.frontmatter.tags;
        if (Array.isArray(tags)) {
          tags.forEach(t => this.existingTags.add(t.replace(/^#/, '')));
        }
      }
    }
  }

  async suggestTags(content: string, maxTags: number = 5): Promise<TagSuggestion[]> {
    const existingTagsList = Array.from(this.existingTags).slice(0, 50).join(', ');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a tagging assistant. Analyze the given content and suggest relevant tags.

Existing tags in the vault: ${existingTagsList || 'none yet'}

Guidelines:
1. Prefer existing tags when they fit well
2. Create new tags only when necessary
3. Use lowercase, hyphen-separated format (e.g., machine-learning)
4. Be specific but not overly granular
5. Consider topics, themes, content type, and actions

Return a JSON array with this format:
[{"tag": "tag-name", "confidence": 0.9, "reason": "brief explanation"}]

Return ${maxTags} or fewer tags. Only output valid JSON.`,
      },
      {
        role: 'user',
        content: content.slice(0, 3000), // Limit content length
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const suggestions: TagSuggestion[] = JSON.parse(jsonMatch[0]);
      return suggestions.slice(0, maxTags);
    } catch (error) {
      console.error('Tag suggestion failed:', error);
      return [];
    }
  }

  async classifyNote(content: string, categories?: string[]): Promise<ClassificationResult> {
    const defaultCategories = [
      'work',
      'personal',
      'learning',
      'project',
      'meeting',
      'idea',
      'reference',
      'journal',
      'task',
      'other',
    ];

    const categoryList = categories || defaultCategories;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a classification assistant. Classify the given content into one of these categories:
${categoryList.join(', ')}

Return a JSON object with this format:
{"category": "chosen-category", "confidence": 0.9, "suggestedFolder": "path/suggestion"}

Only output valid JSON.`,
      },
      {
        role: 'user',
        content: content.slice(0, 2000),
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { category: 'other', confidence: 0 };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Classification failed:', error);
      return { category: 'other', confidence: 0 };
    }
  }

  async applyTags(file: TFile, tags: string[]): Promise<void> {
    const content = await this.vault.read(file);
    const formattedTags = tags.map(t => t.startsWith('#') ? t : `#${t}`);

    // Check if file has frontmatter
    const hasFrontmatter = content.startsWith('---');

    if (hasFrontmatter) {
      // Add tags to existing frontmatter
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        const frontmatter = content.slice(0, frontmatterEnd + 3);
        const body = content.slice(frontmatterEnd + 3);

        // Check if tags field exists
        if (frontmatter.includes('tags:')) {
          // Append to existing tags
          const newContent = content.replace(
            /tags:\s*(\[.*?\]|\n(?:\s*-\s*\w+)+)/,
            (match) => {
              if (match.includes('[')) {
                // Inline format
                const existingTags = match.match(/\[(.*?)\]/)?.[1]?.split(',').map(t => t.trim()) || [];
                const allTags = [...new Set([...existingTags, ...tags])];
                return `tags: [${allTags.join(', ')}]`;
              } else {
                // List format
                const newTagsStr = tags.map(t => `  - ${t}`).join('\n');
                return match + '\n' + newTagsStr;
              }
            }
          );
          await this.vault.modify(file, newContent);
        } else {
          // Add tags field to frontmatter
          const tagsYaml = `tags: [${tags.join(', ')}]\n`;
          const newFrontmatter = frontmatter.slice(0, -3) + tagsYaml + '---';
          await this.vault.modify(file, newFrontmatter + body);
        }
      }
    } else {
      // Add frontmatter with tags
      const frontmatter = `---\ntags: [${tags.join(', ')}]\n---\n\n`;
      await this.vault.modify(file, frontmatter + content);
    }

    // Update local cache
    tags.forEach(t => this.existingTags.add(t.replace(/^#/, '')));
  }

  async autoTagFile(file: TFile): Promise<TagSuggestion[]> {
    const content = await this.vault.cachedRead(file);
    const suggestions = await this.suggestTags(content);

    if (suggestions.length > 0) {
      const highConfidenceTags = suggestions
        .filter(s => s.confidence >= 0.7)
        .map(s => s.tag);

      if (highConfidenceTags.length > 0) {
        await this.applyTags(file, highConfidenceTags);
      }
    }

    return suggestions;
  }

  async batchAutoTag(
    files: TFile[],
    progressCallback?: (current: number, total: number, file: string) => void
  ): Promise<Map<string, TagSuggestion[]>> {
    const results = new Map<string, TagSuggestion[]>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progressCallback?.(i + 1, files.length, file.path);

      try {
        const suggestions = await this.autoTagFile(file);
        results.set(file.path, suggestions);
      } catch (error) {
        console.error(`Failed to tag ${file.path}:`, error);
        results.set(file.path, []);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  async suggestFolderOrganization(file: TFile): Promise<string | null> {
    const content = await this.vault.cachedRead(file);
    const classification = await this.classifyNote(content);

    return classification.suggestedFolder || null;
  }

  getExistingTags(): string[] {
    return Array.from(this.existingTags);
  }

  async generateTagHierarchy(): Promise<string> {
    const tags = Array.from(this.existingTags);

    if (tags.length === 0) {
      return 'No tags found in vault.';
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an organization assistant. Given a list of tags, create a logical hierarchy/taxonomy.
Group related tags together under parent categories.
Output in markdown format with indented bullet points.`,
      },
      {
        role: 'user',
        content: `Organize these tags into a hierarchy:\n${tags.join(', ')}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }
}
