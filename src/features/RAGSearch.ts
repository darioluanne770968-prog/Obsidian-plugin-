import { TFile, Vault, MetadataCache } from 'obsidian';
import { AIService } from '../services/AIService';

export interface VectorDocument {
  id: string;
  path: string;
  title: string;
  content: string;
  embedding: number[];
  metadata: {
    created: number;
    modified: number;
    tags: string[];
  };
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  snippet: string;
}

export class RAGSearch {
  private aiService: AIService;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private vectorStore: Map<string, VectorDocument> = new Map();
  private indexedPaths: Set<string> = new Set();

  constructor(aiService: AIService, vault: Vault, metadataCache: MetadataCache) {
    this.aiService = aiService;
    this.vault = vault;
    this.metadataCache = metadataCache;
  }

  async indexNote(file: TFile): Promise<void> {
    try {
      const content = await this.vault.cachedRead(file);
      const metadata = this.metadataCache.getFileCache(file);

      // Skip very short notes
      if (content.length < 50) return;

      // Chunk long content
      const chunks = this.chunkContent(content, file.path);

      for (const chunk of chunks) {
        const embeddingResponse = await this.aiService.getEmbedding(chunk.content);

        const doc: VectorDocument = {
          id: chunk.id,
          path: file.path,
          title: file.basename,
          content: chunk.content,
          embedding: embeddingResponse.embedding,
          metadata: {
            created: file.stat.ctime,
            modified: file.stat.mtime,
            tags: metadata?.tags?.map(t => t.tag) || [],
          },
        };

        this.vectorStore.set(doc.id, doc);
      }

      this.indexedPaths.add(file.path);
    } catch (error) {
      console.error(`Failed to index ${file.path}:`, error);
    }
  }

  private chunkContent(content: string, path: string): { id: string; content: string }[] {
    const maxChunkSize = 1000; // characters
    const overlap = 100;
    const chunks: { id: string; content: string }[] = [];

    if (content.length <= maxChunkSize) {
      return [{ id: `${path}#0`, content }];
    }

    let start = 0;
    let chunkIndex = 0;

    while (start < content.length) {
      let end = start + maxChunkSize;

      // Try to break at paragraph or sentence boundary
      if (end < content.length) {
        const paragraphBreak = content.lastIndexOf('\n\n', end);
        const sentenceBreak = content.lastIndexOf('. ', end);

        if (paragraphBreak > start + maxChunkSize / 2) {
          end = paragraphBreak;
        } else if (sentenceBreak > start + maxChunkSize / 2) {
          end = sentenceBreak + 1;
        }
      }

      chunks.push({
        id: `${path}#${chunkIndex}`,
        content: content.slice(start, end).trim(),
      });

      start = end - overlap;
      chunkIndex++;
    }

    return chunks;
  }

  async indexAllNotes(progressCallback?: (current: number, total: number) => void): Promise<void> {
    const files = this.vault.getMarkdownFiles();
    let processed = 0;

    for (const file of files) {
      if (!this.indexedPaths.has(file.path)) {
        await this.indexNote(file);
        processed++;
        progressCallback?.(processed, files.length);
      }
    }
  }

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (this.vectorStore.size === 0) {
      return [];
    }

    // Get query embedding
    const queryEmbedding = await this.aiService.getEmbedding(query);

    // Calculate cosine similarity with all documents
    const results: { doc: VectorDocument; score: number }[] = [];

    for (const doc of this.vectorStore.values()) {
      const score = this.cosineSimilarity(queryEmbedding.embedding, doc.embedding);
      results.push({ doc, score });
    }

    // Sort by score and take top K
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    return topResults.map(r => ({
      document: r.doc,
      score: r.score,
      snippet: this.generateSnippet(r.doc.content, query),
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private generateSnippet(content: string, query: string, maxLength: number = 200): string {
    const words = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    // Find the first occurrence of any query word
    let bestStart = 0;
    for (const word of words) {
      const index = contentLower.indexOf(word);
      if (index !== -1) {
        bestStart = Math.max(0, index - 50);
        break;
      }
    }

    let snippet = content.slice(bestStart, bestStart + maxLength);

    // Clean up the snippet
    if (bestStart > 0) snippet = '...' + snippet;
    if (bestStart + maxLength < content.length) snippet += '...';

    return snippet;
  }

  async findSimilarNotes(filePath: string, topK: number = 5): Promise<SearchResult[]> {
    const docs = Array.from(this.vectorStore.values()).filter(d => d.path === filePath);

    if (docs.length === 0) {
      // Note not indexed, try to index it first
      const file = this.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.indexNote(file);
      }
    }

    // Get all document embeddings for this file and average them
    const fileDocs = Array.from(this.vectorStore.values()).filter(d => d.path === filePath);
    if (fileDocs.length === 0) return [];

    // Average the embeddings
    const avgEmbedding = new Array(fileDocs[0].embedding.length).fill(0);
    for (const doc of fileDocs) {
      for (let i = 0; i < doc.embedding.length; i++) {
        avgEmbedding[i] += doc.embedding[i] / fileDocs.length;
      }
    }

    // Find similar documents (excluding the source file)
    const results: { doc: VectorDocument; score: number }[] = [];

    for (const doc of this.vectorStore.values()) {
      if (doc.path === filePath) continue;

      const score = this.cosineSimilarity(avgEmbedding, doc.embedding);
      results.push({ doc, score });
    }

    // Sort and deduplicate by path
    results.sort((a, b) => b.score - a.score);

    const seenPaths = new Set<string>();
    const uniqueResults: SearchResult[] = [];

    for (const r of results) {
      if (!seenPaths.has(r.doc.path)) {
        seenPaths.add(r.doc.path);
        uniqueResults.push({
          document: r.doc,
          score: r.score,
          snippet: r.doc.content.slice(0, 200) + '...',
        });
      }
      if (uniqueResults.length >= topK) break;
    }

    return uniqueResults;
  }

  removeFromIndex(filePath: string): void {
    const keysToRemove: string[] = [];
    for (const [key, doc] of this.vectorStore.entries()) {
      if (doc.path === filePath) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this.vectorStore.delete(key));
    this.indexedPaths.delete(filePath);
  }

  clearIndex(): void {
    this.vectorStore.clear();
    this.indexedPaths.clear();
  }

  getIndexedCount(): number {
    return this.indexedPaths.size;
  }

  async saveIndex(dataPath: string): Promise<void> {
    const data = {
      documents: Array.from(this.vectorStore.values()),
      indexedPaths: Array.from(this.indexedPaths),
    };

    // This would be called from the plugin to save to disk
    // The actual file writing happens in the main plugin
    return data as any;
  }

  loadIndex(data: any): void {
    if (data.documents) {
      for (const doc of data.documents) {
        this.vectorStore.set(doc.id, doc);
      }
    }
    if (data.indexedPaths) {
      for (const path of data.indexedPaths) {
        this.indexedPaths.add(path);
      }
    }
  }
}
