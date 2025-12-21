import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface PDFPage {
  pageNumber: number;
  text: string;
  hasImages: boolean;
}

export interface PDFAnalysis {
  title: string;
  author?: string;
  totalPages: number;
  summary: string;
  keyTopics: string[];
  chapters: { title: string; startPage: number }[];
  extractedNotes: string;
}

export interface PDFQuestion {
  question: string;
  answer: string;
  relevantPages: number[];
  confidence: number;
}

export class PDFProcessor {
  private aiService: AIService;
  private vault: Vault;
  private pdfCache: Map<string, { pages: PDFPage[]; metadata: any }> = new Map();

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async processPDF(file: TFile): Promise<PDFPage[]> {
    // Note: Obsidian's API doesn't have built-in PDF parsing
    // This would use pdf.js or similar library in a real implementation
    // For now, we'll use vision models to process PDF pages as images

    const arrayBuffer = await this.vault.readBinary(file);
    const base64 = this.arrayBufferToBase64(arrayBuffer);

    // In a real implementation, we'd parse the PDF and extract text
    // For now, we'll simulate with a placeholder
    const pages: PDFPage[] = [];

    // Use AI to describe what it sees (for image-based PDFs)
    try {
      const response = await this.aiService.analyzeImage(
        base64,
        'Extract and transcribe all text from this PDF page. Maintain formatting where possible.'
      );

      pages.push({
        pageNumber: 1,
        text: response.content,
        hasImages: true,
      });
    } catch (error) {
      console.error('PDF processing error:', error);
    }

    this.pdfCache.set(file.path, { pages, metadata: {} });
    return pages;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async analyzePDF(file: TFile): Promise<PDFAnalysis> {
    let pages = this.pdfCache.get(file.path)?.pages;
    if (!pages) {
      pages = await this.processPDF(file);
    }

    const allText = pages.map(p => p.text).join('\n\n---PAGE---\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this PDF content and extract key information.

Return JSON:
{
  "title": "document title",
  "author": "author if found",
  "totalPages": number,
  "summary": "comprehensive summary",
  "keyTopics": ["topic1", "topic2"],
  "chapters": [{"title": "chapter name", "startPage": 1}]
}`,
      },
      {
        role: 'user',
        content: allText.slice(0, 10000),
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let analysis: PDFAnalysis = {
      title: file.basename,
      totalPages: pages.length,
      summary: '',
      keyTopics: [],
      chapters: [],
      extractedNotes: '',
    };

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis = { ...analysis, ...parsed };
    }

    // Generate structured notes
    analysis.extractedNotes = await this.generateNotesFromPDF(allText);

    return analysis;
  }

  private async generateNotesFromPDF(content: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Convert this PDF content into well-structured Markdown notes.

Guidelines:
- Use proper heading hierarchy
- Extract key points as bullet lists
- Preserve important quotes
- Add section summaries
- Include any definitions or key terms
- Make it scannable and useful for future reference`,
      },
      {
        role: 'user',
        content: content.slice(0, 8000),
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async askPDFQuestion(file: TFile, question: string): Promise<PDFQuestion> {
    let pages = this.pdfCache.get(file.path)?.pages;
    if (!pages) {
      pages = await this.processPDF(file);
    }

    const allText = pages.map((p, i) => `[Page ${i + 1}]\n${p.text}`).join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Answer questions about this PDF document. Cite specific page numbers.

Return JSON:
{
  "answer": "detailed answer",
  "relevantPages": [1, 2],
  "confidence": 0.0-1.0
}`,
      },
      {
        role: 'user',
        content: `Document:\n${allText.slice(0, 8000)}\n\nQuestion: ${question}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        question,
        ...result,
      };
    }

    return {
      question,
      answer: response.content,
      relevantPages: [],
      confidence: 0.5,
    };
  }

  async extractCitations(file: TFile): Promise<{
    citations: { text: string; page: number }[];
    bibliography: string[];
  }> {
    let pages = this.pdfCache.get(file.path)?.pages;
    if (!pages) {
      pages = await this.processPDF(file);
    }

    const allText = pages.map(p => p.text).join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Extract citations and references from this academic document.

Return JSON:
{
  "citations": [{"text": "citation text", "page": 1}],
  "bibliography": ["formatted reference 1", "formatted reference 2"]
}`,
      },
      {
        role: 'user',
        content: allText.slice(0, 10000),
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { citations: [], bibliography: [] };
  }

  async comparePDFs(file1: TFile, file2: TFile): Promise<string> {
    const pages1 = await this.processPDF(file1);
    const pages2 = await this.processPDF(file2);

    const text1 = pages1.map(p => p.text).join('\n').slice(0, 5000);
    const text2 = pages2.map(p => p.text).join('\n').slice(0, 5000);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Compare these two documents and identify:
1. Common themes and overlap
2. Key differences
3. Unique contributions of each
4. How they might complement each other`,
      },
      {
        role: 'user',
        content: `Document 1 (${file1.basename}):\n${text1}\n\n---\n\nDocument 2 (${file2.basename}):\n${text2}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async generateFlashcardsFromPDF(file: TFile, maxCards: number = 10): Promise<{
    front: string;
    back: string;
    page: number;
  }[]> {
    let pages = this.pdfCache.get(file.path)?.pages;
    if (!pages) {
      pages = await this.processPDF(file);
    }

    const allText = pages.map((p, i) => `[Page ${i + 1}]\n${p.text}`).join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Create flashcards from this document for effective learning.

Return JSON:
{
  "cards": [
    {"front": "question", "back": "answer", "page": 1}
  ]
}

Create ${maxCards} high-quality flashcards covering key concepts.`,
      },
      {
        role: 'user',
        content: allText.slice(0, 8000),
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.cards || [];
    }

    return [];
  }

  clearCache(filePath?: string): void {
    if (filePath) {
      this.pdfCache.delete(filePath);
    } else {
      this.pdfCache.clear();
    }
  }
}
