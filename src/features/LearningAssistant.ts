import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface SpacedRepetitionItem {
  noteId: string;
  notePath: string;
  concept: string;
  lastReview: number;
  nextReview: number;
  difficulty: number; // 0-1, higher = harder
  interval: number; // days
  repetitions: number;
  easeFactor: number;
}

export interface LearningPath {
  topic: string;
  steps: {
    order: number;
    title: string;
    description: string;
    type: 'read' | 'practice' | 'create' | 'review';
    resources: string[];
    estimatedTime: string;
    completed: boolean;
  }[];
  prerequisites: string[];
  outcomes: string[];
}

export interface ConceptExplanation {
  concept: string;
  simpleExplanation: string;
  analogies: string[];
  examples: string[];
  commonMisconceptions: string[];
  relatedConcepts: string[];
  depthLevels: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
}

export class LearningAssistant {
  private aiService: AIService;
  private vault: Vault;
  private spacedRepetitionItems: Map<string, SpacedRepetitionItem> = new Map();

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  // Spaced Repetition System (SM-2 Algorithm variant)
  async addToSpacedRepetition(
    file: TFile,
    concepts?: string[]
  ): Promise<SpacedRepetitionItem[]> {
    const content = await this.vault.cachedRead(file);
    const items: SpacedRepetitionItem[] = [];

    // Extract concepts if not provided
    if (!concepts || concepts.length === 0) {
      concepts = await this.extractKeyConcepts(content);
    }

    for (const concept of concepts) {
      const itemId = `${file.path}::${concept}`;

      if (!this.spacedRepetitionItems.has(itemId)) {
        const item: SpacedRepetitionItem = {
          noteId: itemId,
          notePath: file.path,
          concept,
          lastReview: 0,
          nextReview: Date.now(),
          difficulty: 0.3, // Default medium difficulty
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
        };

        this.spacedRepetitionItems.set(itemId, item);
        items.push(item);
      }
    }

    return items;
  }

  private async extractKeyConcepts(content: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Extract 3-5 key concepts that should be remembered from this note. Return one concept per line.',
      },
      { role: 'user', content: content.slice(0, 2000) },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .map(c => c.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(c => c.length > 0)
      .slice(0, 5);
  }

  getDueItems(): SpacedRepetitionItem[] {
    const now = Date.now();
    return Array.from(this.spacedRepetitionItems.values())
      .filter(item => item.nextReview <= now)
      .sort((a, b) => a.nextReview - b.nextReview);
  }

  reviewItem(itemId: string, quality: number): void {
    // quality: 0-5 (0 = complete failure, 5 = perfect recall)
    const item = this.spacedRepetitionItems.get(itemId);
    if (!item) return;

    item.lastReview = Date.now();
    item.repetitions++;

    // SM-2 algorithm
    if (quality >= 3) {
      // Correct response
      if (item.repetitions === 1) {
        item.interval = 1;
      } else if (item.repetitions === 2) {
        item.interval = 6;
      } else {
        item.interval = Math.round(item.interval * item.easeFactor);
      }

      item.easeFactor = Math.max(1.3,
        item.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );
    } else {
      // Incorrect response
      item.repetitions = 0;
      item.interval = 1;
    }

    item.nextReview = item.lastReview + item.interval * 24 * 60 * 60 * 1000;
    item.difficulty = 1 - (quality / 5);
  }

  async generateLearningPath(topic: string, currentLevel: string = 'beginner'): Promise<LearningPath> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Create a structured learning path for the given topic and level.

Return JSON:
{
  "topic": "topic name",
  "steps": [
    {
      "order": 1,
      "title": "step title",
      "description": "what to do",
      "type": "read|practice|create|review",
      "resources": ["resource suggestions"],
      "estimatedTime": "time estimate"
    }
  ],
  "prerequisites": ["what you should know first"],
  "outcomes": ["what you'll be able to do after"]
}

Create 5-10 steps. Be specific and actionable.`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\nCurrent level: ${currentLevel}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const path = JSON.parse(jsonMatch[0]);
      return {
        ...path,
        steps: path.steps.map((s: any) => ({ ...s, completed: false })),
      };
    }

    return {
      topic,
      steps: [],
      prerequisites: [],
      outcomes: [],
    };
  }

  async explainConcept(concept: string, context?: string): Promise<ConceptExplanation> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Explain a concept thoroughly for learning purposes.

Return JSON:
{
  "concept": "concept name",
  "simpleExplanation": "ELI5 explanation",
  "analogies": ["analogy 1", "analogy 2"],
  "examples": ["example 1", "example 2"],
  "commonMisconceptions": ["misconception 1"],
  "relatedConcepts": ["related 1", "related 2"],
  "depthLevels": {
    "beginner": "basic explanation",
    "intermediate": "more detailed explanation",
    "advanced": "expert-level nuances"
  }
}`,
      },
      {
        role: 'user',
        content: context ? `Concept: ${concept}\n\nContext:\n${context}` : `Explain: ${concept}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      concept,
      simpleExplanation: response.content,
      analogies: [],
      examples: [],
      commonMisconceptions: [],
      relatedConcepts: [],
      depthLevels: {
        beginner: response.content,
        intermediate: '',
        advanced: '',
      },
    };
  }

  async generateQuiz(content: string, questionCount: number = 5): Promise<{
    questions: {
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
    }[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a quiz from the given content.

Return JSON:
{
  "questions": [
    {
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "why this is correct"
    }
  ]
}

Generate ${questionCount} questions. Mix difficulty levels.`,
      },
      { role: 'user', content: content.slice(0, 3000) },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { questions: [] };
  }

  async identifyPrerequisites(topic: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'List 3-5 prerequisite concepts/skills needed before learning this topic. One per line.',
      },
      { role: 'user', content: `Topic: ${topic}` },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .map(p => p.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(p => p.length > 0);
  }

  async assessUnderstanding(concept: string, userExplanation: string): Promise<{
    score: number;
    feedback: string;
    gaps: string[];
    suggestions: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Assess how well the user understands a concept based on their explanation.

Return JSON:
{
  "score": 0-100,
  "feedback": "overall feedback",
  "gaps": ["knowledge gaps identified"],
  "suggestions": ["how to improve understanding"]
}

Be constructive and encouraging while being accurate.`,
      },
      {
        role: 'user',
        content: `Concept: ${concept}\n\nUser's explanation:\n${userExplanation}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      score: 50,
      feedback: 'Unable to assess',
      gaps: [],
      suggestions: [],
    };
  }

  // Pomodoro-style study session
  async generateStudySession(
    topic: string,
    durationMinutes: number = 25
  ): Promise<{
    warmUp: string;
    mainActivity: string;
    review: string;
    breaks: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Design a focused study session.

Return JSON:
{
  "warmUp": "2-3 minute warm-up activity",
  "mainActivity": "main learning activity",
  "review": "end-of-session review activity",
  "breaks": ["break activity suggestion 1", "break activity suggestion 2"]
}

Duration: ${durationMinutes} minutes total.`,
      },
      { role: 'user', content: `Topic: ${topic}` },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      warmUp: 'Review your previous notes on the topic',
      mainActivity: `Study ${topic} actively`,
      review: 'Summarize what you learned in your own words',
      breaks: ['Take a short walk', 'Stretch for 2 minutes'],
    };
  }

  getSpacedRepetitionStats(): {
    totalItems: number;
    dueToday: number;
    mastered: number;
    struggling: number;
    averageEaseFactor: number;
  } {
    const items = Array.from(this.spacedRepetitionItems.values());
    const now = Date.now();
    const today = now + 24 * 60 * 60 * 1000;

    return {
      totalItems: items.length,
      dueToday: items.filter(i => i.nextReview <= today).length,
      mastered: items.filter(i => i.interval >= 21).length, // 3+ week interval
      struggling: items.filter(i => i.difficulty > 0.7).length,
      averageEaseFactor: items.length > 0
        ? items.reduce((sum, i) => sum + i.easeFactor, 0) / items.length
        : 2.5,
    };
  }

  setSpacedRepetitionItems(items: SpacedRepetitionItem[]): void {
    this.spacedRepetitionItems.clear();
    for (const item of items) {
      this.spacedRepetitionItems.set(item.noteId, item);
    }
  }

  getSpacedRepetitionItems(): SpacedRepetitionItem[] {
    return Array.from(this.spacedRepetitionItems.values());
  }
}
