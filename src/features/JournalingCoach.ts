import { AIService, ChatMessage } from '../services/AIService';

export interface JournalPrompt {
  category: 'reflection' | 'gratitude' | 'goals' | 'emotions' | 'growth' | 'creativity' | 'relationships';
  prompt: string;
  followUp?: string;
  depth: 'quick' | 'medium' | 'deep';
}

export interface JournalAnalysis {
  entryDate: string;
  mood: number; // -1 to 1
  dominantEmotions: string[];
  themes: string[];
  gratitudeItems: string[];
  concerns: string[];
  growthAreas: string[];
  actionableInsights: string[];
}

export interface JournalTrends {
  period: string;
  moodTrend: { date: string; mood: number }[];
  topEmotions: { emotion: string; frequency: number }[];
  topThemes: { theme: string; count: number }[];
  growthProgress: string[];
  patterns: string[];
  suggestions: string[];
}

export class JournalingCoach {
  private aiService: AIService;
  private journalHistory: JournalAnalysis[] = [];

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async generatePrompt(
    category?: JournalPrompt['category'],
    context?: string
  ): Promise<JournalPrompt> {
    const categories: JournalPrompt['category'][] = [
      'reflection', 'gratitude', 'goals', 'emotions', 'growth', 'creativity', 'relationships'
    ];

    const selectedCategory = category || categories[Math.floor(Math.random() * categories.length)];

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a thoughtful journaling prompt for the category: ${selectedCategory}

Return JSON:
{
  "prompt": "main journaling prompt",
  "followUp": "optional follow-up question to go deeper",
  "depth": "quick|medium|deep"
}

Make prompts:
- Specific and thought-provoking
- Open-ended (not yes/no)
- Emotionally safe but growth-oriented`,
      },
      {
        role: 'user',
        content: context ? `Context from recent entries: ${context}` : 'Generate a fresh prompt',
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let promptData = {
      prompt: 'What is on your mind today?',
      followUp: undefined,
      depth: 'medium' as const,
    };

    if (jsonMatch) {
      promptData = { ...promptData, ...JSON.parse(jsonMatch[0]) };
    }

    return {
      category: selectedCategory,
      ...promptData,
    };
  }

  async analyzeEntry(content: string, date?: string): Promise<JournalAnalysis> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this journal entry with empathy and insight.

Return JSON:
{
  "mood": -1.0 to 1.0,
  "dominantEmotions": ["emotion1", "emotion2"],
  "themes": ["theme1", "theme2"],
  "gratitudeItems": ["thing grateful for"],
  "concerns": ["concern expressed"],
  "growthAreas": ["area of potential growth"],
  "actionableInsights": ["insight that could be acted upon"]
}

Be supportive and non-judgmental in your analysis.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let analysis: JournalAnalysis = {
      entryDate: date || new Date().toISOString().split('T')[0],
      mood: 0,
      dominantEmotions: [],
      themes: [],
      gratitudeItems: [],
      concerns: [],
      growthAreas: [],
      actionableInsights: [],
    };

    if (jsonMatch) {
      analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
    }

    this.journalHistory.push(analysis);
    return analysis;
  }

  async generateMorningPages(): Promise<string[]> {
    return [
      "Write freely for the next few minutes. Don't worry about grammar or making sense. Just let your thoughts flow onto the page.",
      "What's the first thing that comes to mind when you think about today?",
      "If you could accomplish just one thing today, what would it be?",
      "What are you carrying from yesterday that you'd like to release?",
      "What would make today great?",
    ];
  }

  async generateEveningReflection(): Promise<string[]> {
    return [
      "What are three things that went well today?",
      "What challenged you today, and how did you respond?",
      "What did you learn about yourself today?",
      "Who or what are you grateful for today?",
      "What would you do differently if you could replay today?",
      "What are you looking forward to tomorrow?",
    ];
  }

  async generateWeeklyReview(): Promise<string[]> {
    return [
      "What were your biggest wins this week?",
      "What didn't go as planned, and what can you learn from it?",
      "What progress did you make toward your goals?",
      "Who did you connect with this week? How did those interactions make you feel?",
      "What are you most grateful for from this week?",
      "What do you want to focus on next week?",
      "What one thing could you do differently to make next week better?",
    ];
  }

  async provideFeedback(entry: string): Promise<{
    acknowledgment: string;
    reflection: string;
    question: string;
    encouragement: string;
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Respond to this journal entry as a supportive coach.

Return JSON:
{
  "acknowledgment": "acknowledge what they shared",
  "reflection": "reflect back what you notice",
  "question": "a gentle question to explore further",
  "encouragement": "words of encouragement"
}

Be warm, empathetic, and non-judgmental.`,
      },
      {
        role: 'user',
        content: entry,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      acknowledgment: 'Thank you for sharing.',
      reflection: 'I notice you have a lot on your mind.',
      question: 'What feels most important to explore right now?',
      encouragement: 'Keep writing - every entry is valuable.',
    };
  }

  async generateTrends(entries: JournalAnalysis[]): Promise<JournalTrends> {
    if (entries.length === 0) {
      return {
        period: 'No entries',
        moodTrend: [],
        topEmotions: [],
        topThemes: [],
        growthProgress: [],
        patterns: [],
        suggestions: [],
      };
    }

    const emotionCounts: Map<string, number> = new Map();
    const themeCounts: Map<string, number> = new Map();

    for (const entry of entries) {
      for (const emotion of entry.dominantEmotions) {
        emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
      }
      for (const theme of entry.themes) {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze journaling trends and provide insights.

Return JSON:
{
  "growthProgress": ["area of growth observed"],
  "patterns": ["pattern noticed"],
  "suggestions": ["suggestion for journaling practice"]
}`,
      },
      {
        role: 'user',
        content: `Entries summary:\n${entries.map(e => `[${e.entryDate}] Mood: ${e.mood}, Emotions: ${e.dominantEmotions.join(', ')}`).join('\n')}`,
      },
    ];

    let aiAnalysis = { growthProgress: [], patterns: [], suggestions: [] };
    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Trends analysis failed:', error);
    }

    return {
      period: `${entries[0].entryDate} to ${entries[entries.length - 1].entryDate}`,
      moodTrend: entries.map(e => ({ date: e.entryDate, mood: e.mood })),
      topEmotions: Array.from(emotionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([emotion, frequency]) => ({ emotion, frequency })),
      topThemes: Array.from(themeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count })),
      ...aiAnalysis,
    };
  }

  async guidedSession(topic: 'anxiety' | 'gratitude' | 'goals' | 'self-discovery' | 'relationships'): Promise<string[]> {
    const sessions: Record<string, string[]> = {
      anxiety: [
        "Take a few deep breaths. What's causing you to feel anxious right now?",
        "Where do you feel this anxiety in your body?",
        "What's the worst that could realistically happen?",
        "What's within your control in this situation?",
        "What has helped you manage anxiety in the past?",
        "What small step could you take right now to feel more at ease?",
      ],
      gratitude: [
        "What's something small that brought you joy today?",
        "Who is someone you're grateful to have in your life? Why?",
        "What's a challenge you've faced that you're now grateful for?",
        "What's something about yourself that you appreciate?",
        "What modern convenience are you thankful for today?",
        "How can you express gratitude to someone today?",
      ],
      goals: [
        "What's a goal that's been on your mind lately?",
        "Why is this goal important to you? What will it give you?",
        "What's currently standing in your way?",
        "What resources or support do you have available?",
        "What's the smallest next step you could take?",
        "How will you celebrate progress along the way?",
      ],
      'self-discovery': [
        "What makes you feel most alive?",
        "When do you feel most like yourself?",
        "What's a belief you've changed in the last few years?",
        "What would you do if you knew you couldn't fail?",
        "What do you want to be remembered for?",
        "What's something you've been avoiding thinking about?",
      ],
      relationships: [
        "Think of an important relationship. What do you value most about it?",
        "Is there a relationship that needs attention right now?",
        "What do you bring to your relationships?",
        "What boundary might you need to set or reinforce?",
        "Who has influenced you the most, and how?",
        "How can you show appreciation to someone important to you?",
      ],
    };

    return sessions[topic] || sessions.gratitude;
  }

  getJournalHistory(): JournalAnalysis[] {
    return [...this.journalHistory];
  }

  setJournalHistory(history: JournalAnalysis[]): void {
    this.journalHistory = history;
  }
}
