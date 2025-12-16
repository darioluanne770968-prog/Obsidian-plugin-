import { AIService, ChatMessage } from '../services/AIService';

export interface Flashcard {
  front: string;
  back: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  type: 'basic' | 'cloze' | 'reverse';
}

export interface AnkiCard {
  deckName: string;
  modelName: string;
  fields: {
    Front: string;
    Back: string;
  };
  tags: string[];
}

export class FlashcardGenerator {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async generateBasicCards(content: string, maxCards: number = 10): Promise<Flashcard[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a flashcard creation expert. Create effective flashcards from the given content.

Guidelines for good flashcards:
1. One concept per card
2. Questions should be clear and specific
3. Answers should be concise but complete
4. Avoid yes/no questions
5. Focus on key facts, definitions, and concepts

Return a JSON array:
[{"front": "question", "back": "answer", "difficulty": "medium", "type": "basic", "tags": ["topic"]}]

Create up to ${maxCards} cards.
Only output valid JSON.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Flashcard generation failed:', error);
      return [];
    }
  }

  async generateClozeCards(content: string, maxCards: number = 10): Promise<Flashcard[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a flashcard creation expert. Create cloze deletion flashcards from the given content.

Cloze format: Use {{c1::hidden text}} for deletions.
Example: "The capital of France is {{c1::Paris}}."

Guidelines:
1. Delete key terms, not common words
2. Ensure context is sufficient to guess the answer
3. One deletion per card usually works best
4. Multiple deletions (c1, c2, c3) for complex facts

Return a JSON array:
[{"front": "sentence with {{c1::deletion}}", "back": "", "type": "cloze", "difficulty": "medium", "tags": ["topic"]}]

Create up to ${maxCards} cards.
Only output valid JSON.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Cloze card generation failed:', error);
      return [];
    }
  }

  async generateQuestionAnswerPairs(content: string, maxPairs: number = 10): Promise<{ question: string; answer: string }[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a study assistant. Generate question-answer pairs from the given content.

Create diverse question types:
- What/Who/When/Where/Why/How questions
- Definition questions ("What is...?")
- Comparison questions ("How does X differ from Y?")
- Application questions ("How would you...?")

Return a JSON array:
[{"question": "clear question", "answer": "complete answer"}]

Create up to ${maxPairs} pairs.
Only output valid JSON.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Q&A generation failed:', error);
      return [];
    }
  }

  formatAsMarkdownCards(cards: Flashcard[]): string {
    const lines: string[] = ['## Flashcards\n'];

    cards.forEach((card, index) => {
      lines.push(`### Card ${index + 1}`);

      if (card.type === 'cloze') {
        lines.push(`**Cloze:** ${card.front}`);
      } else {
        lines.push(`**Q:** ${card.front}`);
        lines.push(`**A:** ${card.back}`);
      }

      if (card.difficulty) {
        lines.push(`*Difficulty: ${card.difficulty}*`);
      }

      if (card.tags && card.tags.length > 0) {
        lines.push(`Tags: ${card.tags.map(t => `#${t}`).join(' ')}`);
      }

      lines.push('');
    });

    return lines.join('\n');
  }

  formatAsAnkiImport(cards: Flashcard[], deckName: string = 'Obsidian Import'): string {
    // TSV format for Anki import
    const lines: string[] = [];

    for (const card of cards) {
      if (card.type === 'cloze') {
        lines.push(`${card.front}\t${card.tags?.join(' ') || ''}`);
      } else {
        lines.push(`${card.front}\t${card.back}\t${card.tags?.join(' ') || ''}`);
      }
    }

    return lines.join('\n');
  }

  convertToAnkiConnect(cards: Flashcard[], deckName: string = 'Obsidian'): AnkiCard[] {
    return cards.map(card => ({
      deckName,
      modelName: card.type === 'cloze' ? 'Cloze' : 'Basic',
      fields: {
        Front: card.front,
        Back: card.back || '',
      },
      tags: card.tags || [],
    }));
  }

  async generateFromHighlights(highlights: string[]): Promise<Flashcard[]> {
    const content = highlights.map((h, i) => `${i + 1}. ${h}`).join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a flashcard expert. Convert these highlights/annotations into effective flashcards.

For each highlight, create 1-2 cards that test recall of the key information.
Mix card types (basic Q&A and cloze deletions).

Return a JSON array:
[{"front": "question or cloze", "back": "answer", "type": "basic|cloze", "difficulty": "easy|medium|hard"}]

Only output valid JSON.`,
      },
      {
        role: 'user',
        content: `Highlights:\n${content}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Highlight card generation failed:', error);
      return [];
    }
  }

  async generateReviewQuestions(topic: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<Flashcard[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an educator creating review questions about a topic.

Difficulty level: ${difficulty}
- Easy: Basic recall and definitions
- Medium: Understanding and application
- Hard: Analysis, synthesis, and edge cases

Create 10 questions at the ${difficulty} level.

Return a JSON array:
[{"front": "question", "back": "detailed answer", "type": "basic", "difficulty": "${difficulty}"}]

Only output valid JSON.`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Review question generation failed:', error);
      return [];
    }
  }
}
