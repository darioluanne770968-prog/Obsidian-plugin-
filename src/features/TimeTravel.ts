import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface NoteVersion {
  date: Date;
  content: string;
  wordCount: number;
  summary: string;
}

export interface EvolutionAnalysis {
  notePath: string;
  totalVersions: number;
  lifespan: string;
  growthPattern: 'steady' | 'burst' | 'stagnant' | 'declining';
  keyMilestones: {
    date: string;
    change: string;
    significance: 'major' | 'minor';
  }[];
  predictions: string[];
}

export interface ThoughtEvolution {
  topic: string;
  timeline: {
    period: string;
    belief: string;
    evidence: string[];
  }[];
  shifts: {
    from: string;
    to: string;
    when: string;
    trigger?: string;
  }[];
  currentPosition: string;
}

export interface FutureProjection {
  topic: string;
  currentState: string;
  projections: {
    timeframe: string;
    scenario: string;
    probability: 'high' | 'medium' | 'low';
    assumptions: string[];
  }[];
  actionItems: string[];
}

export class TimeTravel {
  private aiService: AIService;
  private vault: Vault;

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async analyzeNoteEvolution(file: TFile): Promise<EvolutionAnalysis> {
    // Note: In a real implementation, this would integrate with git or
    // Obsidian Sync history. For now, we analyze based on metadata and content.

    const content = await this.vault.cachedRead(file);
    const created = new Date(file.stat.ctime);
    const modified = new Date(file.stat.mtime);
    const lifespanDays = Math.floor((modified.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

    // Analyze content for evolution patterns
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this note and predict its evolution pattern.

Return JSON:
{
  "growthPattern": "steady|burst|stagnant|declining",
  "keyMilestones": [{"date": "estimate", "change": "what changed", "significance": "major|minor"}],
  "predictions": ["future prediction 1", "future prediction 2"]
}

Base analysis on:
- Content depth and completeness
- Structure and organization
- Topics covered vs potential topics`,
      },
      {
        role: 'user',
        content: `Note: ${file.basename}\nCreated: ${created.toDateString()}\nLast modified: ${modified.toDateString()}\n\nContent:\n${content.slice(0, 3000)}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let analysis: Partial<EvolutionAnalysis> = {
      growthPattern: 'steady',
      keyMilestones: [],
      predictions: [],
    };

    if (jsonMatch) {
      analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
    }

    return {
      notePath: file.path,
      totalVersions: 1, // Would be more with version control integration
      lifespan: `${lifespanDays} days`,
      growthPattern: analysis.growthPattern as EvolutionAnalysis['growthPattern'],
      keyMilestones: analysis.keyMilestones || [],
      predictions: analysis.predictions || [],
    };
  }

  async trackThoughtEvolution(topic: string): Promise<ThoughtEvolution> {
    const files = this.vault.getMarkdownFiles();
    const relevantNotes: { file: TFile; content: string; date: Date }[] = [];

    // Find notes mentioning the topic
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      if (content.toLowerCase().includes(topic.toLowerCase())) {
        relevantNotes.push({
          file,
          content,
          date: new Date(file.stat.ctime),
        });
      }
    }

    // Sort by date
    relevantNotes.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (relevantNotes.length === 0) {
      return {
        topic,
        timeline: [],
        shifts: [],
        currentPosition: 'No notes found on this topic.',
      };
    }

    // Analyze evolution
    const timelineData = relevantNotes.map(n => ({
      date: n.date.toISOString().split('T')[0],
      content: n.content.slice(0, 1000),
    }));

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze how thinking on this topic has evolved over time.

Return JSON:
{
  "timeline": [{"period": "date/range", "belief": "position held", "evidence": ["quote from notes"]}],
  "shifts": [{"from": "old belief", "to": "new belief", "when": "timeframe", "trigger": "what caused change"}],
  "currentPosition": "current understanding"
}

Look for:
- Changes in opinion
- Deepening understanding
- Contradictions resolved
- New perspectives gained`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nNotes over time:\n${JSON.stringify(timelineData, null, 2)}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return { topic, ...result };
    }

    return {
      topic,
      timeline: [],
      shifts: [],
      currentPosition: 'Unable to analyze evolution.',
    };
  }

  async projectFuture(topic: string, context?: string): Promise<FutureProjection> {
    const files = this.vault.getMarkdownFiles();
    let relevantContent = context || '';

    if (!context) {
      for (const file of files.slice(0, 50)) {
        const content = await this.vault.cachedRead(file);
        if (content.toLowerCase().includes(topic.toLowerCase())) {
          relevantContent += `\n\n[${file.basename}]\n${content.slice(0, 500)}`;
        }
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Based on the current state of knowledge/work on this topic, project possible futures.

Return JSON:
{
  "currentState": "summary of current state",
  "projections": [
    {
      "timeframe": "1 month / 3 months / 1 year",
      "scenario": "what might happen",
      "probability": "high|medium|low",
      "assumptions": ["assumption 1"]
    }
  ],
  "actionItems": ["suggested action 1", "suggested action 2"]
}

Be thoughtful and grounded in the actual content.`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nContext from notes:\n${relevantContent.slice(0, 5000)}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return { topic, ...result };
    }

    return {
      topic,
      currentState: 'Unable to determine current state.',
      projections: [],
      actionItems: [],
    };
  }

  async whatIfAnalysis(scenario: string, context?: string): Promise<{
    scenario: string;
    implications: {
      area: string;
      impact: string;
      likelihood: 'certain' | 'likely' | 'possible' | 'unlikely';
    }[];
    opportunities: string[];
    risks: string[];
    recommendations: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Perform a "What If" analysis for the given scenario.

Return JSON:
{
  "implications": [{"area": "affected area", "impact": "what would happen", "likelihood": "certain|likely|possible|unlikely"}],
  "opportunities": ["opportunity 1"],
  "risks": ["risk 1"],
  "recommendations": ["recommendation 1"]
}

Think through second and third-order effects.`,
      },
      {
        role: 'user',
        content: context
          ? `Scenario: ${scenario}\n\nContext:\n${context}`
          : `What if: ${scenario}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return { scenario, ...result };
    }

    return {
      scenario,
      implications: [],
      opportunities: [],
      risks: [],
      recommendations: [],
    };
  }

  async generateRetrospective(
    timeRange: 'week' | 'month' | 'quarter' | 'year'
  ): Promise<{
    period: string;
    notesCreated: number;
    topTopics: string[];
    achievements: string[];
    patterns: string[];
    growthAreas: string[];
    suggestions: string[];
  }> {
    const now = Date.now();
    const ranges = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      quarter: 90 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const cutoff = now - ranges[timeRange];
    const files = this.vault.getMarkdownFiles()
      .filter(f => f.stat.ctime > cutoff);

    const contentSamples: string[] = [];
    for (const file of files.slice(0, 50)) {
      const content = await this.vault.cachedRead(file);
      contentSamples.push(`[${file.basename}]\n${content.slice(0, 300)}`);
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a retrospective analysis for the given time period.

Return JSON:
{
  "topTopics": ["topic1", "topic2", "topic3"],
  "achievements": ["achievement 1"],
  "patterns": ["pattern observed"],
  "growthAreas": ["area of growth"],
  "suggestions": ["suggestion for next period"]
}

Be specific and actionable.`,
      },
      {
        role: 'user',
        content: `Period: Last ${timeRange}\nNotes created: ${files.length}\n\nSample content:\n${contentSamples.join('\n\n---\n\n')}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let result = {
      topTopics: [],
      achievements: [],
      patterns: [],
      growthAreas: [],
      suggestions: [],
    };

    if (jsonMatch) {
      result = { ...result, ...JSON.parse(jsonMatch[0]) };
    }

    return {
      period: timeRange,
      notesCreated: files.length,
      ...result,
    };
  }

  async compareTimeframes(
    period1: { start: Date; end: Date },
    period2: { start: Date; end: Date }
  ): Promise<{
    period1Summary: string;
    period2Summary: string;
    changes: string[];
    improvements: string[];
    regressions: string[];
  }> {
    const getNotesInPeriod = async (start: Date, end: Date) => {
      return this.vault.getMarkdownFiles()
        .filter(f => f.stat.ctime >= start.getTime() && f.stat.ctime <= end.getTime());
    };

    const files1 = await getNotesInPeriod(period1.start, period1.end);
    const files2 = await getNotesInPeriod(period2.start, period2.end);

    const getContentSample = async (files: TFile[]) => {
      const samples: string[] = [];
      for (const file of files.slice(0, 20)) {
        const content = await this.vault.cachedRead(file);
        samples.push(`[${file.basename}]\n${content.slice(0, 200)}`);
      }
      return samples.join('\n\n');
    };

    const content1 = await getContentSample(files1);
    const content2 = await getContentSample(files2);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Compare two time periods of notes and identify changes.

Return JSON:
{
  "period1Summary": "summary of first period",
  "period2Summary": "summary of second period",
  "changes": ["notable change"],
  "improvements": ["improvement observed"],
  "regressions": ["any regression or decline"]
}`,
      },
      {
        role: 'user',
        content: `Period 1 (${files1.length} notes):\n${content1}\n\n---\n\nPeriod 2 (${files2.length} notes):\n${content2}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      period1Summary: '',
      period2Summary: '',
      changes: [],
      improvements: [],
      regressions: [],
    };
  }
}
