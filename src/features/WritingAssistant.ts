import { AIService, ChatMessage } from '../services/AIService';

export type WritingAction =
  | 'continue'
  | 'rewrite'
  | 'expand'
  | 'compress'
  | 'translate'
  | 'fix_grammar'
  | 'make_formal'
  | 'make_casual'
  | 'simplify'
  | 'elaborate';

export interface WritingOptions {
  targetLanguage?: string;
  style?: string;
  length?: 'short' | 'medium' | 'long';
}

export class WritingAssistant {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  private getSystemPrompt(action: WritingAction, options?: WritingOptions): string {
    const prompts: Record<WritingAction, string> = {
      continue: `You are a writing assistant. Continue writing the given text naturally, maintaining the same style, tone, and topic. Write about 2-3 paragraphs of continuation. Only output the continuation, not the original text.`,

      rewrite: `You are a writing assistant. Rewrite the given text to improve clarity, flow, and readability while preserving the original meaning. Output only the rewritten text.`,

      expand: `You are a writing assistant. Expand the given text with more details, examples, and explanations. Make it more comprehensive while keeping the core message. Output only the expanded text.`,

      compress: `You are a writing assistant. Compress the given text to be more concise while keeping all key information. Remove redundancy and unnecessary words. Output only the compressed text.`,

      translate: `You are a professional translator. Translate the given text to ${options?.targetLanguage || 'English'}. Maintain the original meaning, tone, and style. Output only the translation.`,

      fix_grammar: `You are a grammar editor. Fix any grammar, spelling, and punctuation errors in the given text. Keep the original meaning and style. Output only the corrected text.`,

      make_formal: `You are a writing assistant. Rewrite the given text in a more formal, professional tone suitable for business or academic contexts. Output only the formal version.`,

      make_casual: `You are a writing assistant. Rewrite the given text in a more casual, conversational tone. Make it friendly and approachable. Output only the casual version.`,

      simplify: `You are a writing assistant. Simplify the given text to make it easier to understand. Use simpler words and shorter sentences. Output only the simplified text.`,

      elaborate: `You are a writing assistant. Elaborate on the given text by adding more context, background information, and supporting details. Output only the elaborated text.`,
    };

    return prompts[action];
  }

  async process(
    text: string,
    action: WritingAction,
    options?: WritingOptions
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(action, options);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async continueWriting(text: string): Promise<string> {
    return this.process(text, 'continue');
  }

  async rewrite(text: string): Promise<string> {
    return this.process(text, 'rewrite');
  }

  async expand(text: string): Promise<string> {
    return this.process(text, 'expand');
  }

  async compress(text: string): Promise<string> {
    return this.process(text, 'compress');
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    return this.process(text, 'translate', { targetLanguage });
  }

  async fixGrammar(text: string): Promise<string> {
    return this.process(text, 'fix_grammar');
  }

  async makeFormal(text: string): Promise<string> {
    return this.process(text, 'make_formal');
  }

  async makeCasual(text: string): Promise<string> {
    return this.process(text, 'make_casual');
  }

  async simplify(text: string): Promise<string> {
    return this.process(text, 'simplify');
  }

  async elaborate(text: string): Promise<string> {
    return this.process(text, 'elaborate');
  }

  async customPrompt(text: string, customInstruction: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: `You are a helpful writing assistant. Follow the user's instruction exactly.` },
      { role: 'user', content: `Instruction: ${customInstruction}\n\nText:\n${text}` },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }
}
