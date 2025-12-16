import { AIService, ChatMessage } from '../services/AIService';

export interface SummaryOptions {
  length?: 'brief' | 'standard' | 'detailed';
  format?: 'paragraph' | 'bullets' | 'numbered';
  language?: string;
}

export interface KeyPoint {
  point: string;
  importance: 'high' | 'medium' | 'low';
}

export class NoteSummarizer {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async summarize(content: string, options?: SummaryOptions): Promise<string> {
    const lengthGuide = {
      brief: '2-3 sentences',
      standard: '1 paragraph (4-6 sentences)',
      detailed: '2-3 paragraphs',
    };

    const formatGuide = {
      paragraph: 'Write in paragraph form.',
      bullets: 'Use bullet points.',
      numbered: 'Use a numbered list.',
    };

    const length = options?.length || 'standard';
    const format = options?.format || 'paragraph';

    const systemPrompt = `You are a professional summarizer. Create a ${lengthGuide[length]} summary of the given text. ${formatGuide[format]} Focus on the main ideas and key takeaways. ${options?.language ? `Write the summary in ${options.language}.` : ''} Output only the summary.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async extractKeyPoints(content: string, maxPoints: number = 5): Promise<string[]> {
    const systemPrompt = `You are an expert at identifying key points in text. Extract the ${maxPoints} most important points from the given text. Return each point on a new line, prefixed with "- ". Be concise but informative.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content },
    ];

    const response = await this.aiService.chat(messages);

    // Parse the bullet points
    const points = response.content
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0);

    return points.slice(0, maxPoints);
  }

  async generateTitle(content: string): Promise<string> {
    const systemPrompt = `You are a title generator. Create a concise, descriptive title for the given text. The title should be clear, engaging, and accurately represent the content. Output only the title, without quotes or extra formatting.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content },
    ];

    const response = await this.aiService.chat(messages);
    return response.content.trim().replace(/^["']|["']$/g, '');
  }

  async generateAbstract(content: string): Promise<string> {
    const systemPrompt = `You are an academic writer. Generate an abstract for the given text. The abstract should be a single paragraph that provides a concise overview of the main topic, methodology (if applicable), key findings, and conclusions. Keep it between 150-250 words. Output only the abstract.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async generateTLDR(content: string): Promise<string> {
    const systemPrompt = `You are a summarizer. Create a TL;DR (Too Long; Didn't Read) summary of the given text in 1-2 sentences. Be extremely concise while capturing the essence. Output only the TL;DR text.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async summarizeMultiple(notes: { title: string; content: string }[]): Promise<string> {
    const combined = notes
      .map(note => `## ${note.title}\n${note.content}`)
      .join('\n\n---\n\n');

    const systemPrompt = `You are a professional summarizer. You are given multiple notes. Create a unified summary that synthesizes the information from all notes. Identify common themes, key points, and how the notes relate to each other. Output a well-structured summary.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: combined },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async extractActionItems(content: string): Promise<string[]> {
    const systemPrompt = `You are an assistant that identifies action items and to-dos from text. Extract any tasks, action items, or things that need to be done from the given text. Return each item on a new line, prefixed with "- [ ] " (markdown checkbox format). If there are no action items, return "No action items found."`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content },
    ];

    const response = await this.aiService.chat(messages);

    if (response.content.includes('No action items found')) {
      return [];
    }

    return response.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('- [ ]'));
  }
}
