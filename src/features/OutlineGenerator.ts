import { AIService, ChatMessage } from '../services/AIService';

export interface OutlineItem {
  level: number;
  text: string;
  children?: OutlineItem[];
}

export class OutlineGenerator {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async generateOutline(topic: string, options?: {
    depth?: number;
    style?: 'academic' | 'blog' | 'technical' | 'creative';
    length?: 'short' | 'medium' | 'long';
  }): Promise<string> {
    const depth = options?.depth || 3;
    const style = options?.style || 'blog';
    const length = options?.length || 'medium';

    const lengthGuide = {
      short: '5-7 main sections',
      medium: '8-12 main sections',
      long: '15-20 main sections',
    };

    const styleGuide = {
      academic: 'Use formal academic structure with introduction, literature review, methodology, findings, discussion, conclusion.',
      blog: 'Use engaging headings, include hooks, tips, and actionable takeaways.',
      technical: 'Use clear technical structure with prerequisites, concepts, implementation, examples, troubleshooting.',
      creative: 'Use creative and engaging section titles that capture attention.',
    };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert outline creator. Create a detailed outline in markdown format.
${styleGuide[style]}
Use proper markdown heading levels (## for main sections, ### for subsections, etc.).
Include ${lengthGuide[length]}.
Maximum nesting depth: ${depth} levels.
Output only the outline in markdown format.`,
      },
      {
        role: 'user',
        content: `Create a detailed outline for: ${topic}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async expandSection(outline: string, sectionHeading: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a content writer. Given an outline and a specific section, write detailed content for that section.
Write 2-4 paragraphs of well-structured content.
Use clear explanations and examples where appropriate.
Maintain consistency with the overall outline context.`,
      },
      {
        role: 'user',
        content: `Outline:\n${outline}\n\nWrite content for the section: "${sectionHeading}"`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async expandAllSections(outline: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a content writer. Given an outline, expand each section with detailed content.
For each section:
- Keep the heading
- Write 1-3 paragraphs of content
- Use clear explanations and examples
- Maintain flow between sections

Output as a complete markdown document.`,
      },
      {
        role: 'user',
        content: `Expand this outline into a full document:\n\n${outline}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async suggestSubsections(section: string, context?: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an outline assistant. Suggest 3-5 subsections for the given section.
Return each suggestion on a new line, prefixed with "- ".
Make suggestions specific and actionable.`,
      },
      {
        role: 'user',
        content: context
          ? `Context:\n${context}\n\nSuggest subsections for: "${section}"`
          : `Suggest subsections for: "${section}"`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());
  }

  async reorganizeOutline(outline: string, instruction: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an outline editor. Reorganize the given outline according to the user's instruction.
Maintain proper markdown heading hierarchy.
Output only the reorganized outline.`,
      },
      {
        role: 'user',
        content: `Outline:\n${outline}\n\nInstruction: ${instruction}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async generateFromNotes(notes: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an outline creator. Given raw notes or bullet points, create a well-structured outline.
- Identify main themes and group related points
- Create a logical hierarchy
- Use clear, descriptive headings
- Output in markdown format with proper heading levels`,
      },
      {
        role: 'user',
        content: `Create an outline from these notes:\n\n${notes}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async convertToDocument(outline: string, style: 'prose' | 'bullets' | 'mixed' = 'mixed'): Promise<string> {
    const styleGuide = {
      prose: 'Write in flowing paragraphs.',
      bullets: 'Use bullet points throughout.',
      mixed: 'Use paragraphs for main content and bullets for lists and key points.',
    };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a document writer. Convert the outline into a complete document.
${styleGuide[style]}
Ensure smooth transitions between sections.
Keep the original structure but add depth and detail.`,
      },
      {
        role: 'user',
        content: `Convert this outline into a document:\n\n${outline}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }
}
