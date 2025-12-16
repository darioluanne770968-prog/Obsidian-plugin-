import { TFile, Vault, MetadataCache, CachedMetadata } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface Entity {
  name: string;
  type: 'person' | 'concept' | 'place' | 'organization' | 'event' | 'other';
  mentions: string[]; // file paths where this entity appears
  description?: string;
}

export interface Relationship {
  source: string; // entity name
  target: string; // entity name
  type: string; // relationship type
  strength: number; // 0-1
  evidence: string[]; // snippets supporting this relationship
}

export interface LinkSuggestion {
  fromPath: string;
  toPath: string;
  reason: string;
  confidence: number;
}

export class KnowledgeGraph {
  private aiService: AIService;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();

  constructor(aiService: AIService, vault: Vault, metadataCache: MetadataCache) {
    this.aiService = aiService;
    this.vault = vault;
    this.metadataCache = metadataCache;
  }

  async extractEntities(content: string, filePath: string): Promise<Entity[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an entity extraction system. Extract named entities from the given text.
Return a JSON array of objects with this format:
[
  {"name": "Entity Name", "type": "person|concept|place|organization|event|other", "description": "brief description"}
]

Focus on:
- People and names
- Key concepts and ideas
- Places and locations
- Organizations and companies
- Events and dates
- Technical terms and jargon

Only extract clearly mentioned entities. Return valid JSON only.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);

      // Parse JSON response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const extracted = JSON.parse(jsonMatch[0]);
      const entities: Entity[] = [];

      for (const item of extracted) {
        const entityKey = item.name.toLowerCase();
        const existing = this.entities.get(entityKey);

        if (existing) {
          if (!existing.mentions.includes(filePath)) {
            existing.mentions.push(filePath);
          }
        } else {
          const entity: Entity = {
            name: item.name,
            type: item.type || 'other',
            mentions: [filePath],
            description: item.description,
          };
          this.entities.set(entityKey, entity);
          entities.push(entity);
        }
      }

      return entities;
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  }

  async extractRelationships(content: string, entities: Entity[]): Promise<Relationship[]> {
    if (entities.length < 2) return [];

    const entityNames = entities.map(e => e.name).join(', ');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a relationship extraction system. Given text and a list of entities, identify relationships between them.
Return a JSON array with this format:
[
  {"source": "Entity1", "target": "Entity2", "type": "relationship type", "evidence": "supporting text snippet"}
]

Relationship types include: related_to, part_of, created_by, works_with, located_in, causes, precedes, follows, contradicts, supports, etc.

Only extract relationships that are clearly stated or strongly implied. Return valid JSON only.`,
      },
      {
        role: 'user',
        content: `Entities: ${entityNames}\n\nText:\n${content}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const extracted = JSON.parse(jsonMatch[0]);
      const relationships: Relationship[] = [];

      for (const item of extracted) {
        const relKey = `${item.source}|${item.target}|${item.type}`.toLowerCase();
        const existing = this.relationships.get(relKey);

        if (existing) {
          if (!existing.evidence.includes(item.evidence)) {
            existing.evidence.push(item.evidence);
            existing.strength = Math.min(1, existing.strength + 0.1);
          }
        } else {
          const relationship: Relationship = {
            source: item.source,
            target: item.target,
            type: item.type,
            strength: 0.5,
            evidence: [item.evidence],
          };
          this.relationships.set(relKey, relationship);
          relationships.push(relationship);
        }
      }

      return relationships;
    } catch (error) {
      console.error('Relationship extraction failed:', error);
      return [];
    }
  }

  async suggestLinks(filePath: string, content: string): Promise<LinkSuggestion[]> {
    const allFiles = this.vault.getMarkdownFiles();
    const suggestions: LinkSuggestion[] = [];

    // Get existing links
    const cache = this.metadataCache.getFileCache(
      this.vault.getAbstractFileByPath(filePath) as TFile
    );
    const existingLinks = new Set(
      cache?.links?.map(l => l.link) || []
    );

    // Extract key concepts from current note
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Extract the main topics and concepts from this text. Return a JSON array of strings.
Example: ["machine learning", "neural networks", "data science"]
Return only the JSON array.`,
      },
      {
        role: 'user',
        content: content.slice(0, 2000), // Limit content length
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const concepts: string[] = JSON.parse(jsonMatch[0]);

      // Search for notes containing these concepts
      for (const file of allFiles) {
        if (file.path === filePath) continue;
        if (existingLinks.has(file.basename)) continue;

        const fileContent = await this.vault.cachedRead(file);
        const fileContentLower = fileContent.toLowerCase();
        const matchedConcepts: string[] = [];

        for (const concept of concepts) {
          if (fileContentLower.includes(concept.toLowerCase())) {
            matchedConcepts.push(concept);
          }
        }

        if (matchedConcepts.length > 0) {
          suggestions.push({
            fromPath: filePath,
            toPath: file.path,
            reason: `Shared concepts: ${matchedConcepts.join(', ')}`,
            confidence: Math.min(1, matchedConcepts.length * 0.3),
          });
        }
      }

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);
      return suggestions.slice(0, 10);
    } catch (error) {
      console.error('Link suggestion failed:', error);
      return [];
    }
  }

  async generateRelationshipSummary(): Promise<string> {
    const entities = Array.from(this.entities.values());
    const relationships = Array.from(this.relationships.values());

    if (entities.length === 0) {
      return 'No entities have been extracted yet. Index some notes first.';
    }

    const entitySummary = entities
      .slice(0, 20)
      .map(e => `- ${e.name} (${e.type}): appears in ${e.mentions.length} notes`)
      .join('\n');

    const relationshipSummary = relationships
      .slice(0, 20)
      .map(r => `- ${r.source} → ${r.type} → ${r.target}`)
      .join('\n');

    return `## Knowledge Graph Summary

### Top Entities (${entities.length} total)
${entitySummary}

### Key Relationships (${relationships.length} total)
${relationshipSummary}`;
  }

  async findConnectionPath(entity1: string, entity2: string): Promise<string[]> {
    // Simple BFS to find path between entities
    const visited = new Set<string>();
    const queue: { entity: string; path: string[] }[] = [
      { entity: entity1.toLowerCase(), path: [entity1] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.entity)) continue;
      visited.add(current.entity);

      if (current.entity === entity2.toLowerCase()) {
        return current.path;
      }

      // Find connected entities
      for (const rel of this.relationships.values()) {
        if (rel.source.toLowerCase() === current.entity) {
          queue.push({
            entity: rel.target.toLowerCase(),
            path: [...current.path, `--[${rel.type}]-->`, rel.target],
          });
        }
        if (rel.target.toLowerCase() === current.entity) {
          queue.push({
            entity: rel.source.toLowerCase(),
            path: [...current.path, `<--[${rel.type}]--`, rel.source],
          });
        }
      }
    }

    return []; // No path found
  }

  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getRelationships(): Relationship[] {
    return Array.from(this.relationships.values());
  }

  clearGraph(): void {
    this.entities.clear();
    this.relationships.clear();
  }
}
