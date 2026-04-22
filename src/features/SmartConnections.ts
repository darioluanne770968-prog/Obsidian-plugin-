import { TFile, Vault, MetadataCache } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';
import { RAGSearch } from './RAGSearch';

export interface ConceptLink {
  from: string;
  to: string;
  relationship: string;
  strength: number; // 0-1
  explanation: string;
  isExplicit: boolean; // true if link already exists
}

export interface ConceptCluster {
  name: string;
  notes: string[];
  centralConcept: string;
  relatedConcepts: string[];
}

export interface BridgeNote {
  path: string;
  connects: [string, string];
  bridgingConcepts: string[];
}

export interface SerendipityConnection {
  note1: string;
  note2: string;
  unexpectedConnection: string;
  creativePotential: string;
  combinedInsight: string;
}

export class SmartConnections {
  private aiService: AIService;
  private ragSearch: RAGSearch;
  private vault: Vault;
  private metadataCache: MetadataCache;

  constructor(
    aiService: AIService,
    ragSearch: RAGSearch,
    vault: Vault,
    metadataCache: MetadataCache
  ) {
    this.aiService = aiService;
    this.ragSearch = ragSearch;
    this.vault = vault;
    this.metadataCache = metadataCache;
  }

  async findHiddenConnections(filePath: string, depth: number = 2): Promise<ConceptLink[]> {
    const file = this.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return [];

    const content = await this.vault.cachedRead(file);
    const connections: ConceptLink[] = [];

    // Get existing links
    const cache = this.metadataCache.getFileCache(file);
    const existingLinks = new Set(cache?.links?.map(l => l.link) || []);

    // Find semantically similar notes
    const similarNotes = await this.ragSearch.findSimilarNotes(filePath, 10);

    for (const similar of similarNotes) {
      if (existingLinks.has(similar.document.title)) {
        continue; // Skip existing links
      }

      // Analyze the relationship
      const relationship = await this.analyzeRelationship(
        content,
        similar.document.content,
        file.basename,
        similar.document.title
      );

      if (relationship.strength > 0.5) {
        connections.push({
          from: filePath,
          to: similar.document.path,
          relationship: relationship.type,
          strength: relationship.strength,
          explanation: relationship.explanation,
          isExplicit: false,
        });
      }
    }

    // Sort by strength
    connections.sort((a, b) => b.strength - a.strength);

    return connections.slice(0, 10);
  }

  private async analyzeRelationship(
    content1: string,
    content2: string,
    title1: string,
    title2: string
  ): Promise<{ type: string; strength: number; explanation: string }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze the relationship between two notes and return JSON:
{
  "type": "relationship type (e.g., supports, contradicts, extends, example_of, related_concept)",
  "strength": 0.0 to 1.0,
  "explanation": "brief explanation of connection"
}

Only return high-confidence connections. Return {"type": "none", "strength": 0, "explanation": ""} if no meaningful connection.`,
      },
      {
        role: 'user',
        content: `Note 1 (${title1}):\n${content1.slice(0, 1500)}\n\nNote 2 (${title2}):\n${content2.slice(0, 1500)}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback
    }

    return { type: 'none', strength: 0, explanation: '' };
  }

  async findConceptClusters(): Promise<ConceptCluster[]> {
    const files = this.vault.getMarkdownFiles().slice(0, 100);
    const noteContents: { path: string; content: string; concepts: string[] }[] = [];

    // Extract concepts from each note
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      const concepts = await this.extractConcepts(content);
      noteContents.push({ path: file.path, content, concepts });
    }

    // Cluster by concept overlap
    const clusters: ConceptCluster[] = [];
    const assigned = new Set<string>();

    for (const note of noteContents) {
      if (assigned.has(note.path)) continue;

      const cluster: ConceptCluster = {
        name: note.concepts[0] || 'Unnamed',
        notes: [note.path],
        centralConcept: note.concepts[0] || '',
        relatedConcepts: note.concepts.slice(1),
      };

      // Find similar notes
      for (const other of noteContents) {
        if (other.path === note.path || assigned.has(other.path)) continue;

        const overlap = note.concepts.filter(c =>
          other.concepts.some(oc => oc.toLowerCase().includes(c.toLowerCase()) ||
            c.toLowerCase().includes(oc.toLowerCase()))
        );

        if (overlap.length >= 2) {
          cluster.notes.push(other.path);
          assigned.add(other.path);
          cluster.relatedConcepts = [...new Set([...cluster.relatedConcepts, ...overlap])];
        }
      }

      if (cluster.notes.length > 1) {
        clusters.push(cluster);
        assigned.add(note.path);
      }
    }

    return clusters;
  }

  private async extractConcepts(content: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Extract 3-5 main concepts/topics from this text. Return only concepts, one per line.',
      },
      { role: 'user', content: content.slice(0, 1500) },
    ];

    try {
      const response = await this.aiService.chat(messages);
      return response.content
        .split('\n')
        .map(c => c.replace(/^[-•*\d.]\s*/, '').trim())
        .filter(c => c.length > 0)
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  async findBridgeNotes(): Promise<BridgeNote[]> {
    const clusters = await this.findConceptClusters();
    const bridges: BridgeNote[] = [];

    // Find notes that connect different clusters
    const files = this.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.metadataCache.getFileCache(file);
      const links = cache?.links?.map(l => l.link) || [];

      // Check if this note links to notes in different clusters
      const linkedClusters: ConceptCluster[] = [];

      for (const link of links) {
        for (const cluster of clusters) {
          if (cluster.notes.some(n => n.includes(link))) {
            if (!linkedClusters.includes(cluster)) {
              linkedClusters.push(cluster);
            }
          }
        }
      }

      if (linkedClusters.length >= 2) {
        const content = await this.vault.cachedRead(file);
        const concepts = await this.extractConcepts(content);

        bridges.push({
          path: file.path,
          connects: [linkedClusters[0].name, linkedClusters[1].name],
          bridgingConcepts: concepts,
        });
      }
    }

    return bridges;
  }

  async generateSerendipitousConnection(): Promise<SerendipityConnection> {
    const files = this.vault.getMarkdownFiles();
    if (files.length < 2) {
      throw new Error('Need at least 2 notes for serendipitous connections');
    }

    // Pick two random, unlinked notes
    const shuffled = files.sort(() => Math.random() - 0.5);
    let note1: TFile | null = null;
    let note2: TFile | null = null;

    for (let i = 0; i < shuffled.length && (!note1 || !note2); i++) {
      const file = shuffled[i];
      const cache = this.metadataCache.getFileCache(file);
      const links = cache?.links?.map(l => l.link) || [];

      if (!note1) {
        note1 = file;
        continue;
      }

      // Check if unlinked to note1
      if (!links.includes(note1.basename)) {
        note2 = file;
      }
    }

    if (!note1 || !note2) {
      note1 = shuffled[0];
      note2 = shuffled[1];
    }

    const content1 = await this.vault.cachedRead(note1);
    const content2 = await this.vault.cachedRead(note2);

    // Generate creative connection
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a creative connector. Given two seemingly unrelated notes, find unexpected connections and generate creative insights.

Return JSON:
{
  "unexpectedConnection": "what surprising connection exists",
  "creativePotential": "what new idea could emerge from combining these",
  "combinedInsight": "a novel insight from merging both perspectives"
}

Be creative and think laterally!`,
      },
      {
        role: 'user',
        content: `Note 1 (${note1.basename}):\n${content1.slice(0, 1500)}\n\nNote 2 (${note2.basename}):\n${content2.slice(0, 1500)}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        note1: note1.path,
        note2: note2.path,
        ...result,
      };
    }

    return {
      note1: note1.path,
      note2: note2.path,
      unexpectedConnection: 'Unable to analyze connection',
      creativePotential: '',
      combinedInsight: '',
    };
  }

  async suggestMOC(topic: string): Promise<string> {
    // Generate a Map of Content for a topic
    const searchResults = await this.ragSearch.search(topic, 20);

    if (searchResults.length === 0) {
      return `# ${topic}\n\nNo related notes found. Start writing about this topic!`;
    }

    const noteList = searchResults.map(r => ({
      title: r.document.title,
      path: r.document.path,
      snippet: r.snippet,
    }));

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Create a Map of Content (MOC) for the given topic. A MOC is a curated index note that organizes related notes into logical sections.

Structure:
1. Brief introduction to the topic
2. Organized sections with links to notes
3. Use [[note name]] format for links
4. Add brief descriptions of each linked note

Make it scannable and well-organized.`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nRelated notes:\n${JSON.stringify(noteList, null, 2)}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return `# ${topic}\n\n${response.content}`;
  }

  async analyzeKnowledgeGraph(): Promise<{
    stats: { nodes: number; edges: number; avgConnections: number };
    hubs: { path: string; connections: number }[];
    orphans: string[];
    clusters: number;
  }> {
    const files = this.vault.getMarkdownFiles();
    const connections = new Map<string, Set<string>>();

    // Build graph
    for (const file of files) {
      const cache = this.metadataCache.getFileCache(file);
      const links = cache?.links?.map(l => l.link) || [];
      connections.set(file.path, new Set(links));
    }

    // Calculate stats
    let totalEdges = 0;
    const connectionCounts: { path: string; connections: number }[] = [];
    const orphans: string[] = [];

    for (const [path, links] of connections) {
      const outgoing = links.size;
      const incoming = Array.from(connections.values()).filter(s => s.has(path.replace('.md', ''))).length;
      const total = outgoing + incoming;

      totalEdges += outgoing;
      connectionCounts.push({ path, connections: total });

      if (total === 0) {
        orphans.push(path);
      }
    }

    connectionCounts.sort((a, b) => b.connections - a.connections);

    return {
      stats: {
        nodes: files.length,
        edges: totalEdges,
        avgConnections: files.length > 0 ? totalEdges / files.length : 0,
      },
      hubs: connectionCounts.slice(0, 10),
      orphans,
      clusters: (await this.findConceptClusters()).length,
    };
  }
}
