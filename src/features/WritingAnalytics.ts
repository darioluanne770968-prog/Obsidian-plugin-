import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface WritingSession {
  id: string;
  date: string;
  startTime: number;
  endTime: number;
  duration: number; // minutes
  wordsWritten: number;
  wordsEdited: number;
  filesModified: string[];
  averageWPM: number;
  focusScore: number; // 0-1
}

export interface WritingStats {
  totalWords: number;
  totalNotes: number;
  averageNoteLength: number;
  longestNote: { path: string; words: number };
  shortestNote: { path: string; words: number };
  totalSentences: number;
  averageSentenceLength: number;
  vocabularySize: number;
  readabilityScore: number;
  writingStreak: number;
  bestStreak: number;
}

export interface DailyStats {
  date: string;
  wordsWritten: number;
  notesCreated: number;
  notesModified: number;
  timeSpent: number;
  topCategories: string[];
}

export interface WritingPatterns {
  mostProductiveHour: number;
  mostProductiveDay: string;
  averageSessionLength: number;
  writingFrequency: { [day: string]: number };
  topicTrends: { topic: string; growth: number }[];
  styleEvolution: {
    period: string;
    avgSentenceLength: number;
    vocabularyComplexity: number;
    formalityLevel: number;
  }[];
}

export interface ContentAnalysis {
  topTopics: { topic: string; percentage: number }[];
  topEntities: { entity: string; count: number }[];
  sentimentDistribution: { sentiment: string; percentage: number }[];
  contentTypes: { type: string; count: number }[];
  linkDensity: number;
  tagUsage: { tag: string; count: number }[];
}

export interface WritingGoal {
  id: string;
  type: 'daily-words' | 'weekly-words' | 'notes-per-week' | 'streak' | 'custom';
  target: number;
  current: number;
  startDate: string;
  endDate?: string;
  completed: boolean;
}

export class WritingAnalytics {
  private aiService: AIService;
  private vault: Vault;
  private sessions: WritingSession[] = [];
  private dailyStats: Map<string, DailyStats> = new Map();
  private goals: WritingGoal[] = [];

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async generateFullStats(): Promise<WritingStats> {
    const files = this.vault.getMarkdownFiles();
    let totalWords = 0;
    let totalSentences = 0;
    const allWords: Set<string> = new Set();
    let longestNote = { path: '', words: 0 };
    let shortestNote = { path: '', words: Infinity };

    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      const words = content.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;

      totalWords += wordCount;

      // Track unique words for vocabulary
      words.forEach(w => allWords.add(w.toLowerCase().replace(/[^a-z]/g, '')));

      // Count sentences
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      totalSentences += sentences.length;

      if (wordCount > longestNote.words) {
        longestNote = { path: file.path, words: wordCount };
      }
      if (wordCount < shortestNote.words && wordCount > 0) {
        shortestNote = { path: file.path, words: wordCount };
      }
    }

    const averageNoteLength = files.length > 0 ? totalWords / files.length : 0;
    const averageSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;

    // Calculate readability (Flesch-Kincaid approximation)
    const readabilityScore = Math.max(0, Math.min(100,
      206.835 - 1.015 * averageSentenceLength - 84.6 * (totalWords / Math.max(1, totalSentences * 3))
    ));

    // Calculate streak
    const streak = this.calculateStreak();

    return {
      totalWords,
      totalNotes: files.length,
      averageNoteLength: Math.round(averageNoteLength),
      longestNote,
      shortestNote: shortestNote.words === Infinity ? { path: '', words: 0 } : shortestNote,
      totalSentences,
      averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
      vocabularySize: allWords.size,
      readabilityScore: Math.round(readabilityScore),
      writingStreak: streak.current,
      bestStreak: streak.best,
    };
  }

  private calculateStreak(): { current: number; best: number } {
    const dates = Array.from(this.dailyStats.keys()).sort().reverse();
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);

    // Check current streak
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const stats = this.dailyStats.get(dateStr);

      if (stats && stats.wordsWritten > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // Today hasn't been counted yet, that's ok
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate best streak
    for (const date of dates) {
      const stats = this.dailyStats.get(date);
      if (stats && stats.wordsWritten > 0) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return { current: currentStreak, best: Math.max(bestStreak, currentStreak) };
  }

  async analyzeWritingPatterns(): Promise<WritingPatterns> {
    const hourCounts: number[] = new Array(24).fill(0);
    const dayCounts: { [key: string]: number } = {
      Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0,
      Thursday: 0, Friday: 0, Saturday: 0,
    };

    for (const session of this.sessions) {
      const date = new Date(session.startTime);
      hourCounts[date.getHours()] += session.wordsWritten;

      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[dayName] += session.wordsWritten;
    }

    const mostProductiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    const mostProductiveDay = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Monday';

    const avgSessionLength = this.sessions.length > 0
      ? this.sessions.reduce((sum, s) => sum + s.duration, 0) / this.sessions.length
      : 0;

    return {
      mostProductiveHour,
      mostProductiveDay,
      averageSessionLength: Math.round(avgSessionLength),
      writingFrequency: dayCounts,
      topicTrends: [],
      styleEvolution: [],
    };
  }

  async analyzeContent(): Promise<ContentAnalysis> {
    const files = this.vault.getMarkdownFiles();
    const entityCounts: Map<string, number> = new Map();
    const tagCounts: Map<string, number> = new Map();
    let totalLinks = 0;
    let totalContent = '';

    for (const file of files.slice(0, 100)) {
      const content = await this.vault.cachedRead(file);
      totalContent += content + '\n';

      // Count links
      const links = content.match(/\[\[.*?\]\]/g) || [];
      totalLinks += links.length;

      // Count tags
      const tags = content.match(/#[\w-]+/g) || [];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // AI analysis for topics and entities
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this content sample and extract insights.

Return JSON:
{
  "topTopics": [{"topic": "topic name", "percentage": 0-100}],
  "topEntities": [{"entity": "entity name", "count": number}],
  "sentimentDistribution": [{"sentiment": "positive|neutral|negative", "percentage": 0-100}],
  "contentTypes": [{"type": "type name", "count": number}]
}`,
      },
      {
        role: 'user',
        content: totalContent.slice(0, 8000),
      },
    ];

    let analysis = {
      topTopics: [],
      topEntities: [],
      sentimentDistribution: [],
      contentTypes: [],
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Content analysis failed:', error);
    }

    return {
      ...analysis,
      linkDensity: files.length > 0 ? totalLinks / files.length : 0,
      tagUsage: Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag, count]) => ({ tag, count })),
    };
  }

  async getWritingSuggestions(): Promise<string[]> {
    const stats = await this.generateFullStats();
    const patterns = await this.analyzeWritingPatterns();

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Based on these writing statistics, provide actionable suggestions to improve.

Return a JSON array of suggestions:
["suggestion 1", "suggestion 2", ...]`,
      },
      {
        role: 'user',
        content: `Stats:
- Total words: ${stats.totalWords}
- Total notes: ${stats.totalNotes}
- Average note length: ${stats.averageNoteLength} words
- Average sentence length: ${stats.averageSentenceLength} words
- Vocabulary size: ${stats.vocabularySize}
- Readability score: ${stats.readabilityScore}
- Writing streak: ${stats.writingStreak} days
- Most productive hour: ${patterns.mostProductiveHour}:00
- Most productive day: ${patterns.mostProductiveDay}
- Average session: ${patterns.averageSessionLength} minutes`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Suggestions generation failed:', error);
    }

    return [
      'Try to write at your most productive time',
      'Aim for consistent daily writing',
      'Vary your sentence lengths for better readability',
    ];
  }

  setGoal(type: WritingGoal['type'], target: number): WritingGoal {
    const goal: WritingGoal = {
      id: `goal_${Date.now()}`,
      type,
      target,
      current: 0,
      startDate: new Date().toISOString().split('T')[0],
      completed: false,
    };

    if (type === 'weekly-words' || type === 'notes-per-week') {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      goal.endDate = endDate.toISOString().split('T')[0];
    }

    this.goals.push(goal);
    return goal;
  }

  updateGoalProgress(goalId: string, progress: number): void {
    const goal = this.goals.find(g => g.id === goalId);
    if (goal) {
      goal.current = progress;
      goal.completed = goal.current >= goal.target;
    }
  }

  getActiveGoals(): WritingGoal[] {
    return this.goals.filter(g => !g.completed);
  }

  recordSession(session: Omit<WritingSession, 'id'>): WritingSession {
    const fullSession: WritingSession = {
      id: `session_${Date.now()}`,
      ...session,
    };

    this.sessions.push(fullSession);

    // Update daily stats
    const dateKey = session.date;
    const existing = this.dailyStats.get(dateKey) || {
      date: dateKey,
      wordsWritten: 0,
      notesCreated: 0,
      notesModified: 0,
      timeSpent: 0,
      topCategories: [],
    };

    existing.wordsWritten += session.wordsWritten;
    existing.notesModified += session.filesModified.length;
    existing.timeSpent += session.duration;
    this.dailyStats.set(dateKey, existing);

    return fullSession;
  }

  formatStatsAsMarkdown(stats: WritingStats, patterns: WritingPatterns): string {
    return `# 📊 Writing Analytics

## Overview
| Metric | Value |
|--------|-------|
| Total Words | ${stats.totalWords.toLocaleString()} |
| Total Notes | ${stats.totalNotes} |
| Average Note Length | ${stats.averageNoteLength} words |
| Vocabulary Size | ${stats.vocabularySize.toLocaleString()} unique words |
| Readability Score | ${stats.readabilityScore}/100 |

## Writing Streak
- **Current Streak:** ${stats.writingStreak} days 🔥
- **Best Streak:** ${stats.bestStreak} days 🏆

## Patterns
- **Most Productive Hour:** ${patterns.mostProductiveHour}:00
- **Most Productive Day:** ${patterns.mostProductiveDay}
- **Average Session:** ${patterns.averageSessionLength} minutes

## Longest Notes
1. ${stats.longestNote.path} (${stats.longestNote.words} words)

## Writing Frequency by Day
${Object.entries(patterns.writingFrequency)
  .map(([day, words]) => `- **${day}:** ${words.toLocaleString()} words`)
  .join('\n')}

## Active Goals
${this.getActiveGoals().map(g =>
  `- [ ] ${g.type}: ${g.current}/${g.target} (${Math.round(g.current / g.target * 100)}%)`
).join('\n') || 'No active goals'}
`;
  }

  getSessions(): WritingSession[] {
    return [...this.sessions];
  }

  setSessions(sessions: WritingSession[]): void {
    this.sessions = sessions;
  }

  getDailyStats(): Map<string, DailyStats> {
    return new Map(this.dailyStats);
  }

  setDailyStats(stats: [string, DailyStats][]): void {
    this.dailyStats = new Map(stats);
  }

  getGoals(): WritingGoal[] {
    return [...this.goals];
  }

  setGoals(goals: WritingGoal[]): void {
    this.goals = goals;
  }
}
