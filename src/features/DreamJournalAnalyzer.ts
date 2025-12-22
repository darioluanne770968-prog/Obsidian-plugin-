import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface DreamEntry {
  date: string;
  content: string;
  symbols: string[];
  emotions: string[];
  themes: string[];
  lucidity: number; // 0-1
  vividness: number; // 0-1
  interpretation?: string;
}

export interface DreamPattern {
  pattern: string;
  frequency: number;
  firstOccurrence: string;
  lastOccurrence: string;
  relatedDreams: string[];
  possibleMeaning: string;
}

export interface DreamAnalysis {
  totalDreams: number;
  dateRange: { start: string; end: string };
  recurringSymbols: { symbol: string; count: number; meaning: string }[];
  emotionalPatterns: { emotion: string; frequency: number; trend: string }[];
  themes: { theme: string; count: number }[];
  lucidDreamRate: number;
  insights: string[];
  recommendations: string[];
}

export class DreamJournalAnalyzer {
  private aiService: AIService;
  private vault: Vault;
  private dreamEntries: DreamEntry[] = [];

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async analyzeDream(content: string, date?: string): Promise<DreamEntry> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this dream journal entry.

Return JSON:
{
  "symbols": ["symbol1", "symbol2"],
  "emotions": ["emotion1", "emotion2"],
  "themes": ["theme1", "theme2"],
  "lucidity": 0.0-1.0,
  "vividness": 0.0-1.0,
  "interpretation": "psychological interpretation of the dream"
}

Consider:
- Common dream symbols and their meanings
- Emotional undertones
- Recurring themes
- Level of awareness in the dream
- Vividness of imagery`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let analysis = {
      symbols: [],
      emotions: [],
      themes: [],
      lucidity: 0.5,
      vividness: 0.5,
      interpretation: '',
    };

    if (jsonMatch) {
      analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
    }

    const entry: DreamEntry = {
      date: date || new Date().toISOString().split('T')[0],
      content,
      ...analysis,
    };

    this.dreamEntries.push(entry);
    return entry;
  }

  async findPatterns(): Promise<DreamPattern[]> {
    if (this.dreamEntries.length < 3) {
      return [];
    }

    const allSymbols: Map<string, { dates: string[]; dreams: string[] }> = new Map();
    const allThemes: Map<string, { dates: string[]; dreams: string[] }> = new Map();

    for (const entry of this.dreamEntries) {
      for (const symbol of entry.symbols) {
        const existing = allSymbols.get(symbol) || { dates: [], dreams: [] };
        existing.dates.push(entry.date);
        existing.dreams.push(entry.content.slice(0, 100));
        allSymbols.set(symbol, existing);
      }

      for (const theme of entry.themes) {
        const existing = allThemes.get(theme) || { dates: [], dreams: [] };
        existing.dates.push(entry.date);
        existing.dreams.push(entry.content.slice(0, 100));
        allThemes.set(theme, existing);
      }
    }

    const patterns: DreamPattern[] = [];

    // Find recurring patterns (3+ occurrences)
    for (const [symbol, data] of allSymbols) {
      if (data.dates.length >= 2) {
        const meaning = await this.interpretSymbol(symbol, data.dreams);
        patterns.push({
          pattern: `Recurring symbol: ${symbol}`,
          frequency: data.dates.length,
          firstOccurrence: data.dates[0],
          lastOccurrence: data.dates[data.dates.length - 1],
          relatedDreams: data.dreams,
          possibleMeaning: meaning,
        });
      }
    }

    for (const [theme, data] of allThemes) {
      if (data.dates.length >= 2) {
        patterns.push({
          pattern: `Recurring theme: ${theme}`,
          frequency: data.dates.length,
          firstOccurrence: data.dates[0],
          lastOccurrence: data.dates[data.dates.length - 1],
          relatedDreams: data.dreams,
          possibleMeaning: `This theme appears frequently in your dreams, possibly reflecting ongoing life concerns.`,
        });
      }
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  private async interpretSymbol(symbol: string, contexts: string[]): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Interpret this recurring dream symbol based on the contexts provided.

Consider:
- Universal dream symbolism
- Personal context from the dreams
- Psychological perspectives (Jung, Freud, modern)

Provide a brief, insightful interpretation.`,
      },
      {
        role: 'user',
        content: `Symbol: ${symbol}\n\nContexts:\n${contexts.join('\n')}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async generateFullAnalysis(): Promise<DreamAnalysis> {
    if (this.dreamEntries.length === 0) {
      return {
        totalDreams: 0,
        dateRange: { start: '', end: '' },
        recurringSymbols: [],
        emotionalPatterns: [],
        themes: [],
        lucidDreamRate: 0,
        insights: ['No dreams recorded yet.'],
        recommendations: ['Start recording your dreams upon waking.'],
      };
    }

    const sortedEntries = [...this.dreamEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Count symbols
    const symbolCounts: Map<string, number> = new Map();
    const emotionCounts: Map<string, number> = new Map();
    const themeCounts: Map<string, number> = new Map();
    let lucidCount = 0;

    for (const entry of this.dreamEntries) {
      for (const symbol of entry.symbols) {
        symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1);
      }
      for (const emotion of entry.emotions) {
        emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
      }
      for (const theme of entry.themes) {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      }
      if (entry.lucidity > 0.5) {
        lucidCount++;
      }
    }

    // Get AI insights
    const dreamSummary = this.dreamEntries
      .slice(-10)
      .map(d => `[${d.date}] ${d.content.slice(0, 200)}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this dream journal data and provide insights.

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Consider patterns, emotional health, and actionable advice.`,
      },
      {
        role: 'user',
        content: `Dreams:\n${dreamSummary}\n\nTop symbols: ${Array.from(symbolCounts.entries()).slice(0, 5).map(([s, c]) => `${s}(${c})`).join(', ')}\n\nTop emotions: ${Array.from(emotionCounts.entries()).slice(0, 5).map(([e, c]) => `${e}(${c})`).join(', ')}`,
      },
    ];

    let aiAnalysis = { insights: [], recommendations: [] };
    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Dream analysis failed:', error);
    }

    // Build symbol meanings
    const recurringSymbols = Array.from(symbolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol, count]) => ({
        symbol,
        count,
        meaning: 'Recurring symbol - track for patterns',
      }));

    return {
      totalDreams: this.dreamEntries.length,
      dateRange: {
        start: sortedEntries[0].date,
        end: sortedEntries[sortedEntries.length - 1].date,
      },
      recurringSymbols,
      emotionalPatterns: Array.from(emotionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([emotion, frequency]) => ({
          emotion,
          frequency,
          trend: 'stable',
        })),
      themes: Array.from(themeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([theme, count]) => ({ theme, count })),
      lucidDreamRate: this.dreamEntries.length > 0 ? lucidCount / this.dreamEntries.length : 0,
      insights: aiAnalysis.insights,
      recommendations: aiAnalysis.recommendations,
    };
  }

  async suggestDreamPrompt(): Promise<string> {
    const recentEmotions = this.dreamEntries
      .slice(-5)
      .flatMap(d => d.emotions);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Generate a dream incubation prompt - a question or intention to set before sleep to guide dreams.',
      },
      {
        role: 'user',
        content: `Recent dream emotions: ${recentEmotions.join(', ') || 'none recorded'}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  setDreamEntries(entries: DreamEntry[]): void {
    this.dreamEntries = entries;
  }

  getDreamEntries(): DreamEntry[] {
    return [...this.dreamEntries];
  }

  formatAnalysisAsMarkdown(analysis: DreamAnalysis): string {
    return `# 🌙 Dream Journal Analysis

## Overview
- **Total Dreams:** ${analysis.totalDreams}
- **Date Range:** ${analysis.dateRange.start} to ${analysis.dateRange.end}
- **Lucid Dream Rate:** ${Math.round(analysis.lucidDreamRate * 100)}%

## 🔮 Recurring Symbols
${analysis.recurringSymbols.map(s => `- **${s.symbol}** (${s.count}x)`).join('\n')}

## 💭 Emotional Patterns
${analysis.emotionalPatterns.map(e => `- ${e.emotion}: ${e.frequency}x`).join('\n')}

## 🎭 Common Themes
${analysis.themes.map(t => `- ${t.theme} (${t.count}x)`).join('\n')}

## 💡 Insights
${analysis.insights.map(i => `- ${i}`).join('\n')}

## 📝 Recommendations
${analysis.recommendations.map(r => `- ${r}`).join('\n')}`;
  }
}
