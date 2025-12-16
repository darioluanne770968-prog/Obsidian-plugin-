import { AIService, ChatMessage } from '../services/AIService';
import { RAGSearch, SearchResult } from './RAGSearch';

export interface QAResponse {
  answer: string;
  sources: {
    path: string;
    title: string;
    snippet: string;
    relevanceScore: number;
  }[];
  confidence: 'high' | 'medium' | 'low';
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: QAResponse['sources'];
}

export class SmartQA {
  private aiService: AIService;
  private ragSearch: RAGSearch;
  private conversationHistory: ConversationMessage[] = [];
  private maxHistoryLength: number = 10;

  constructor(aiService: AIService, ragSearch: RAGSearch) {
    this.aiService = aiService;
    this.ragSearch = ragSearch;
  }

  async askQuestion(question: string, useHistory: boolean = true): Promise<QAResponse> {
    // Search for relevant documents
    const searchResults = await this.ragSearch.search(question, 5);

    if (searchResults.length === 0) {
      return {
        answer: "I couldn't find any relevant information in your notes to answer this question. Please make sure your notes are indexed.",
        sources: [],
        confidence: 'low',
      };
    }

    // Build context from search results
    const context = this.buildContext(searchResults);

    // Build conversation messages
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant that answers questions based on the user's personal notes.

Use ONLY the information provided in the context below to answer questions. If the context doesn't contain enough information to fully answer the question, say so.

When answering:
1. Be accurate and cite specific information from the notes
2. If multiple notes discuss the topic, synthesize the information
3. If you're unsure or the information is incomplete, indicate your uncertainty
4. Keep answers concise but comprehensive

Context from user's notes:
${context}`,
      },
    ];

    // Add conversation history if enabled
    if (useHistory && this.conversationHistory.length > 0) {
      const recentHistory = this.conversationHistory.slice(-this.maxHistoryLength);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    messages.push({
      role: 'user',
      content: question,
    });

    // Get AI response
    const response = await this.aiService.chat(messages);

    // Determine confidence based on search scores
    const avgScore = searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length;
    const confidence: 'high' | 'medium' | 'low' =
      avgScore > 0.8 ? 'high' : avgScore > 0.6 ? 'medium' : 'low';

    const sources = searchResults.map(r => ({
      path: r.document.path,
      title: r.document.title,
      snippet: r.snippet,
      relevanceScore: r.score,
    }));

    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: question,
      timestamp: Date.now(),
    });

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
      sources,
    });

    return {
      answer: response.content,
      sources,
      confidence,
    };
  }

  private buildContext(results: SearchResult[]): string {
    return results
      .map((r, i) => `[Note ${i + 1}: ${r.document.title}]\n${r.document.content}`)
      .join('\n\n---\n\n');
  }

  async askFollowUp(question: string): Promise<QAResponse> {
    // Use conversation history for follow-up questions
    return this.askQuestion(question, true);
  }

  async askAboutNote(noteContent: string, question: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant. Answer the user's question based on the provided note content. Be accurate and specific.`,
      },
      {
        role: 'user',
        content: `Note content:\n${noteContent}\n\nQuestion: ${question}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async explainConcept(concept: string): Promise<QAResponse> {
    const question = `What is "${concept}" and how is it discussed in my notes?`;
    return this.askQuestion(question);
  }

  async compareNotes(paths: string[]): Promise<string> {
    const notes: { title: string; content: string }[] = [];

    for (const path of paths) {
      const results = await this.ragSearch.search(path, 1);
      if (results.length > 0) {
        notes.push({
          title: results[0].document.title,
          content: results[0].document.content,
        });
      }
    }

    if (notes.length < 2) {
      return "Need at least 2 notes to compare.";
    }

    const context = notes
      .map((n, i) => `[Note ${i + 1}: ${n.title}]\n${n.content}`)
      .join('\n\n---\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an analyst. Compare the provided notes and identify:
1. Common themes and topics
2. Differences in perspective or information
3. How the notes complement each other
4. Any contradictions or inconsistencies

Provide a clear, structured comparison.`,
      },
      {
        role: 'user',
        content: context,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  setMaxHistoryLength(length: number): void {
    this.maxHistoryLength = length;
  }
}
