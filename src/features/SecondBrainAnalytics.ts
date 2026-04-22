import { TFile, Vault, MetadataCache, CachedMetadata } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface KnowledgeHealthScore {
  overall: number; // 0-100
  dimensions: {
    coverage: number; // How many topics are covered
    depth: number; // How deep is the content
    freshness: number; // How up-to-date
    connectivity: number; // How well-linked
    organization: number; // How well-structured
  };
  insights: string[];
  recommendations: string[];
}

export interface TopicEvolution {
  topic: string;
  timeline: {
    period: string;
    noteCount: number;
    sentiment?: number;
    keyThemes: string[];
  }[];
  trend: 'growing' | 'stable' | 'declining';
}

export interface WritingStyleAnalysis {
  averageSentenceLength: number;
  vocabularyRichness: number;
  formalityScore: number;
  readabilityScore: number;
  commonPatterns: string[];
  strengths: string[];
  areasForImprovement: string[];
  styleFingerprint: string;
}

export interface EmotionalAnalysis {
  overall: {
    positive: number;
    negative: number;
    neutral: number;
  };
  timeline: {
    date: string;
    sentiment: number; // -1 to 1
    dominantEmotion: string;
  }[];
  patterns: {
    description: string;
    frequency: string;
    triggers?: string[];
  }[];
  insights: string[];
}

export interface KnowledgeGap {
  topic: string;
  relatedNotes: string[];
  gapDescription: string;
  suggestedResources: string[];
  priority: 'high' | 'medium' | 'low';
}

export class SecondBrainAnalytics {
  private aiService: AIService;
  private vault: Vault;
  private metadataCache: MetadataCache;

  constructor(aiService: AIService, vault: Vault, metadataCache: MetadataCache) {
    this.aiService = aiService;
    this.vault = vault;
    this.metadataCache = metadataCache;
  }

  async analyzeKnowledgeHealth(): Promise<KnowledgeHealthScore> {
    const files = this.vault.getMarkdownFiles();
    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

    // Calculate basic metrics
    const totalNotes = files.length;
    const recentNotes = files.filter(f => f.stat.mtime > oneMonthAgo).length;
    const staleNotes = files.filter(f => f.stat.mtime < threeMonthsAgo).length;

    // Analyze connectivity
    let totalLinks = 0;
    let totalBacklinks = 0;
    const orphanNotes: string[] = [];

    for (const file of files) {
      const cache = this.metadataCache.getFileCache(file);
      const links = cache?.links?.length || 0;
      // Count backlinks manually by checking which files link to this file
      const backlinks = files.filter(f => {
        const fCache = this.metadataCache.getFileCache(f);
        return fCache?.links?.some(l => l.link === file.basename) || false;
      }).length;

      totalLinks += links;
      totalBacklinks += backlinks;

      if (links === 0 && backlinks === 0) {
        orphanNotes.push(file.path);
      }
    }

    // Calculate dimensions
    const coverage = Math.min(100, (totalNotes / 100) * 100); // Assume 100+ notes is full coverage
    const freshness = totalNotes > 0 ? ((totalNotes - staleNotes) / totalNotes) * 100 : 0;
    const connectivity = totalNotes > 0 ? Math.min(100, ((totalLinks + totalBacklinks) / (totalNotes * 2)) * 100) : 0;

    // Estimate depth by average note length
    let totalLength = 0;
    const sampleSize = Math.min(files.length, 50);
    const sampleFiles = files.slice(0, sampleSize);

    for (const file of sampleFiles) {
      const content = await this.vault.cachedRead(file);
      totalLength += content.length;
    }

    const avgLength = sampleSize > 0 ? totalLength / sampleSize : 0;
    const depth = Math.min(100, (avgLength / 2000) * 100); // 2000 chars = good depth

    // Organization (based on folder structure and tags)
    const folders = new Set<string>();
    let taggedNotes = 0;

    for (const file of files) {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        folders.add(parts[0]);
      }

      const cache = this.metadataCache.getFileCache(file);
      if (cache?.tags && cache.tags.length > 0) {
        taggedNotes++;
      }
    }

    const organization = (
      (folders.size > 0 ? 30 : 0) +
      (taggedNotes / totalNotes * 40) +
      (orphanNotes.length < totalNotes * 0.2 ? 30 : 15)
    );

    const overall = Math.round(
      (coverage * 0.15 + depth * 0.25 + freshness * 0.2 + connectivity * 0.25 + organization * 0.15)
    );

    // Generate insights
    const insights: string[] = [];
    const recommendations: string[] = [];

    if (orphanNotes.length > totalNotes * 0.3) {
      insights.push(`${orphanNotes.length} notes (${Math.round(orphanNotes.length / totalNotes * 100)}%) are orphans with no links.`);
      recommendations.push('Review orphan notes and add connections to your knowledge graph.');
    }

    if (freshness < 50) {
      insights.push(`${Math.round((1 - freshness / 100) * totalNotes)} notes haven't been updated in 3+ months.`);
      recommendations.push('Schedule a review of older notes to keep knowledge fresh.');
    }

    if (recentNotes > totalNotes * 0.3) {
      insights.push('Your knowledge base is growing actively! Great momentum.');
    }

    if (avgLength < 500) {
      insights.push('Most notes are relatively short.');
      recommendations.push('Consider expanding key notes with more detail and examples.');
    }

    return {
      overall,
      dimensions: {
        coverage: Math.round(coverage),
        depth: Math.round(depth),
        freshness: Math.round(freshness),
        connectivity: Math.round(connectivity),
        organization: Math.round(organization),
      },
      insights,
      recommendations,
    };
  }

  async analyzeTopicEvolution(topic: string): Promise<TopicEvolution> {
    const files = this.vault.getMarkdownFiles();
    const relevantNotes: { file: TFile; content: string; date: Date }[] = [];

    // Find notes related to the topic
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      const contentLower = content.toLowerCase();
      const topicLower = topic.toLowerCase();

      if (contentLower.includes(topicLower) || file.basename.toLowerCase().includes(topicLower)) {
        relevantNotes.push({
          file,
          content,
          date: new Date(file.stat.ctime),
        });
      }
    }

    // Group by month
    const byMonth = new Map<string, typeof relevantNotes>();

    for (const note of relevantNotes) {
      const monthKey = `${note.date.getFullYear()}-${String(note.date.getMonth() + 1).padStart(2, '0')}`;
      const existing = byMonth.get(monthKey) || [];
      existing.push(note);
      byMonth.set(monthKey, existing);
    }

    // Analyze each period
    const timeline: TopicEvolution['timeline'] = [];
    const sortedMonths = Array.from(byMonth.keys()).sort();

    for (const month of sortedMonths) {
      const notes = byMonth.get(month)!;
      const combinedContent = notes.map(n => n.content).join('\n\n');

      // Extract key themes using AI
      const themes = await this.extractThemes(combinedContent.slice(0, 3000));

      timeline.push({
        period: month,
        noteCount: notes.length,
        keyThemes: themes,
      });
    }

    // Determine trend
    let trend: TopicEvolution['trend'] = 'stable';
    if (timeline.length >= 3) {
      const recentCounts = timeline.slice(-3).map(t => t.noteCount);
      const olderCounts = timeline.slice(0, -3).map(t => t.noteCount);

      const recentAvg = recentCounts.reduce((a, b) => a + b, 0) / recentCounts.length;
      const olderAvg = olderCounts.length > 0 ?
        olderCounts.reduce((a, b) => a + b, 0) / olderCounts.length : recentAvg;

      if (recentAvg > olderAvg * 1.5) trend = 'growing';
      else if (recentAvg < olderAvg * 0.5) trend = 'declining';
    }

    return { topic, timeline, trend };
  }

  private async extractThemes(content: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Extract 3-5 key themes from this text. Return only the themes, one per line.',
      },
      { role: 'user', content },
    ];

    try {
      const response = await this.aiService.chat(messages);
      return response.content
        .split('\n')
        .map(t => t.replace(/^[-•*\d.]\s*/, '').trim())
        .filter(t => t.length > 0)
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  async analyzeWritingStyle(sampleSize: number = 10): Promise<WritingStyleAnalysis> {
    const files = this.vault.getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, sampleSize);

    let allContent = '';
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      allContent += content + '\n\n';
    }

    // Basic metrics
    const sentences = allContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = allContent.split(/\s+/).filter(w => w.length > 0);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));

    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
    const vocabularyRichness = words.length > 0 ? (uniqueWords.size / words.length) * 100 : 0;

    // AI analysis
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this writing sample and provide:
1. Formality score (0-100, 100 = very formal)
2. Readability score (0-100, 100 = very easy to read)
3. Common patterns (3-5 bullet points)
4. Strengths (2-3 points)
5. Areas for improvement (2-3 points)
6. A one-sentence "style fingerprint" that describes this writer's unique voice

Return as JSON:
{
  "formalityScore": number,
  "readabilityScore": number,
  "commonPatterns": ["..."],
  "strengths": ["..."],
  "areasForImprovement": ["..."],
  "styleFingerprint": "..."
}`,
      },
      {
        role: 'user',
        content: allContent.slice(0, 5000),
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
          vocabularyRichness: Math.round(vocabularyRichness * 10) / 10,
          formalityScore: analysis.formalityScore || 50,
          readabilityScore: analysis.readabilityScore || 50,
          commonPatterns: analysis.commonPatterns || [],
          strengths: analysis.strengths || [],
          areasForImprovement: analysis.areasForImprovement || [],
          styleFingerprint: analysis.styleFingerprint || 'Unable to determine style fingerprint.',
        };
      }
    } catch (error) {
      console.error('Writing style analysis failed:', error);
    }

    return {
      averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      vocabularyRichness: Math.round(vocabularyRichness * 10) / 10,
      formalityScore: 50,
      readabilityScore: 50,
      commonPatterns: [],
      strengths: [],
      areasForImprovement: [],
      styleFingerprint: 'Unable to analyze - please check AI connection.',
    };
  }

  async analyzeEmotions(journalFolder?: string): Promise<EmotionalAnalysis> {
    let files = this.vault.getMarkdownFiles();

    if (journalFolder) {
      files = files.filter(f => f.path.startsWith(journalFolder));
    }

    // Sort by creation date
    files.sort((a, b) => a.stat.ctime - b.stat.ctime);

    const timeline: EmotionalAnalysis['timeline'] = [];
    let positiveTotal = 0;
    let negativeTotal = 0;
    let neutralTotal = 0;

    // Analyze each file (limit to recent 50)
    const recentFiles = files.slice(-50);

    for (const file of recentFiles) {
      const content = await this.vault.cachedRead(file);
      const date = new Date(file.stat.ctime).toISOString().split('T')[0];

      // Quick sentiment analysis
      const sentiment = await this.analyzeSentiment(content.slice(0, 1500));

      timeline.push({
        date,
        sentiment: sentiment.score,
        dominantEmotion: sentiment.emotion,
      });

      if (sentiment.score > 0.2) positiveTotal++;
      else if (sentiment.score < -0.2) negativeTotal++;
      else neutralTotal++;
    }

    const total = recentFiles.length || 1;

    // Identify patterns
    const patterns = await this.identifyEmotionalPatterns(timeline);

    // Generate insights
    const insights: string[] = [];

    if (positiveTotal > total * 0.6) {
      insights.push('Your writing tends to be predominantly positive.');
    } else if (negativeTotal > total * 0.4) {
      insights.push('There appears to be a significant amount of negative sentiment in your recent writing.');
    }

    // Check for trends
    if (timeline.length >= 10) {
      const recentAvg = timeline.slice(-5).reduce((sum, t) => sum + t.sentiment, 0) / 5;
      const olderAvg = timeline.slice(-10, -5).reduce((sum, t) => sum + t.sentiment, 0) / 5;

      if (recentAvg > olderAvg + 0.2) {
        insights.push('Your mood appears to be trending more positive recently.');
      } else if (recentAvg < olderAvg - 0.2) {
        insights.push('Your mood appears to be trending more negative recently.');
      }
    }

    return {
      overall: {
        positive: Math.round((positiveTotal / total) * 100),
        negative: Math.round((negativeTotal / total) * 100),
        neutral: Math.round((neutralTotal / total) * 100),
      },
      timeline,
      patterns,
      insights,
    };
  }

  private async analyzeSentiment(content: string): Promise<{ score: number; emotion: string }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze the sentiment and dominant emotion of this text.
Return JSON: {"score": number (-1 to 1), "emotion": "joy|sadness|anger|fear|surprise|neutral"}`,
      },
      { role: 'user', content },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback
    }

    return { score: 0, emotion: 'neutral' };
  }

  private async identifyEmotionalPatterns(
    timeline: EmotionalAnalysis['timeline']
  ): Promise<EmotionalAnalysis['patterns']> {
    if (timeline.length < 5) {
      return [];
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this emotional timeline and identify patterns.
Return JSON array: [{"description": "pattern description", "frequency": "daily/weekly/occasional", "triggers": ["possible trigger"]}]

Timeline data shows dates and sentiment scores (-1 to 1).`,
      },
      {
        role: 'user',
        content: JSON.stringify(timeline.slice(-30)),
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback
    }

    return [];
  }

  async identifyKnowledgeGaps(): Promise<KnowledgeGap[]> {
    const files = this.vault.getMarkdownFiles();
    const allContent: string[] = [];
    const notesByTopic = new Map<string, string[]>();

    // Sample content
    for (const file of files.slice(0, 100)) {
      const content = await this.vault.cachedRead(file);
      allContent.push(`[${file.basename}]\n${content.slice(0, 500)}`);
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this knowledge base sample and identify knowledge gaps - topics that are mentioned but not deeply explored, or missing connections.

Return JSON array:
[{
  "topic": "topic name",
  "gapDescription": "what's missing",
  "suggestedResources": ["resource types to explore"],
  "priority": "high|medium|low"
}]

Focus on 3-5 significant gaps.`,
      },
      {
        role: 'user',
        content: allContent.slice(0, 30).join('\n\n---\n\n'),
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const gaps = JSON.parse(jsonMatch[0]);
        return gaps.map((g: any) => ({
          ...g,
          relatedNotes: [], // Would need additional search
        }));
      }
    } catch (error) {
      console.error('Knowledge gap analysis failed:', error);
    }

    return [];
  }

  formatHealthScoreAsMarkdown(score: KnowledgeHealthScore): string {
    const bars = (value: number) => {
      const filled = Math.round(value / 10);
      return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };

    return `# 🧠 Knowledge Health Report

## Overall Score: ${score.overall}/100

### Dimensions

| Dimension | Score | Visual |
|-----------|-------|--------|
| Coverage | ${score.dimensions.coverage}% | ${bars(score.dimensions.coverage)} |
| Depth | ${score.dimensions.depth}% | ${bars(score.dimensions.depth)} |
| Freshness | ${score.dimensions.freshness}% | ${bars(score.dimensions.freshness)} |
| Connectivity | ${score.dimensions.connectivity}% | ${bars(score.dimensions.connectivity)} |
| Organization | ${score.dimensions.organization}% | ${bars(score.dimensions.organization)} |

### Insights
${score.insights.map(i => `- 💡 ${i}`).join('\n')}

### Recommendations
${score.recommendations.map(r => `- 📌 ${r}`).join('\n')}

---
*Generated ${new Date().toLocaleDateString()}*`;
  }
}
