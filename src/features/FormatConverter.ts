import { AIService, ChatMessage } from '../services/AIService';

export class FormatConverter {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async toTable(text: string, options?: {
    headers?: string[];
    format?: 'markdown' | 'csv';
  }): Promise<string> {
    const format = options?.format || 'markdown';
    const headerHint = options?.headers
      ? `Use these column headers: ${options.headers.join(', ')}`
      : 'Infer appropriate column headers from the content';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a data formatter. Convert the given text into a ${format} table.
${headerHint}
Identify logical columns and rows from the content.
Output only the table, no explanations.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toBulletList(text: string, options?: {
    style?: 'simple' | 'nested' | 'checklist';
    maxDepth?: number;
  }): Promise<string> {
    const style = options?.style || 'simple';
    const maxDepth = options?.maxDepth || 3;

    const styleGuide = {
      simple: 'Create a flat bullet list with "-" prefix.',
      nested: `Create a nested bullet list with up to ${maxDepth} levels of indentation.`,
      checklist: 'Create a checklist with "- [ ]" format for each item.',
    };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a text formatter. Convert the given text into a bullet list.
${styleGuide[style]}
Preserve the key information and logical grouping.
Output only the formatted list.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toNumberedList(text: string, nested: boolean = false): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a text formatter. Convert the given text into a numbered list.
${nested ? 'Use nested numbering (1, 1.1, 1.2, 2, 2.1, etc.) where appropriate.' : 'Use simple numbering (1, 2, 3, etc.).'}
Preserve the key information.
Output only the numbered list.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toMermaidFlowchart(text: string, direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a diagram creator. Convert the given text into a Mermaid flowchart.
Use direction: ${direction} (TB=top-bottom, LR=left-right, BT=bottom-top, RL=right-left)
Follow Mermaid.js syntax:
- Start with: flowchart ${direction}
- Use --> for arrows
- Use [] for rectangles, () for rounded, {} for diamonds
- Keep node labels concise

Output only the Mermaid code block:
\`\`\`mermaid
flowchart ${direction}
  ...
\`\`\``,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toMermaidMindmap(text: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a diagram creator. Convert the given text into a Mermaid mindmap.
Follow Mermaid mindmap syntax:
\`\`\`mermaid
mindmap
  root((Central Topic))
    Branch1
      Sub1
      Sub2
    Branch2
\`\`\`
Use indentation to show hierarchy.
Output only the Mermaid code block.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toMermaidSequence(text: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a diagram creator. Convert the given text into a Mermaid sequence diagram.
Follow Mermaid sequence diagram syntax:
\`\`\`mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello
    B-->>A: Hi!
\`\`\`
Identify actors and their interactions.
Output only the Mermaid code block.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toMermaidGantt(text: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a diagram creator. Convert the given text into a Mermaid Gantt chart.
Follow Mermaid Gantt syntax:
\`\`\`mermaid
gantt
    title Project Schedule
    dateFormat  YYYY-MM-DD
    section Phase 1
    Task 1           :a1, 2024-01-01, 30d
    Task 2           :after a1, 20d
\`\`\`
Infer reasonable dates and durations if not specified.
Output only the Mermaid code block.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toMermaidPie(text: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a diagram creator. Convert the given text into a Mermaid pie chart.
Follow Mermaid pie chart syntax:
\`\`\`mermaid
pie title Distribution
    "Category A" : 40
    "Category B" : 30
    "Category C" : 30
\`\`\`
Extract categories and values from the text.
Output only the Mermaid code block.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async toCallout(text: string, type: 'note' | 'tip' | 'warning' | 'danger' | 'info' = 'note'): Promise<string> {
    const title = type.charAt(0).toUpperCase() + type.slice(1);
    return `> [!${type}] ${title}\n> ${text.split('\n').join('\n> ')}`;
  }

  async toCode(text: string, language?: string): Promise<string> {
    if (language) {
      return `\`\`\`${language}\n${text}\n\`\`\``;
    }

    // Try to detect language
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a code formatter. Format the given text as a code block.
If it's code, detect the language and output properly formatted code block.
If it's not code, format it appropriately.
Output only the formatted code block.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async jsonToTable(json: string): Promise<string> {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        const headerRow = `| ${headers.join(' | ')} |`;
        const separator = `| ${headers.map(() => '---').join(' | ')} |`;
        const rows = data.map(item =>
          `| ${headers.map(h => String(item[h] ?? '')).join(' | ')} |`
        );
        return [headerRow, separator, ...rows].join('\n');
      }
    } catch {
      // Fall back to AI conversion
    }

    return this.toTable(json);
  }

  async csvToTable(csv: string): Promise<string> {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return '';

    const rows = lines.map(line =>
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    );

    const headerRow = `| ${rows[0].join(' | ')} |`;
    const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
    const dataRows = rows.slice(1).map(row => `| ${row.join(' | ')} |`);

    return [headerRow, separator, ...dataRows].join('\n');
  }
}
