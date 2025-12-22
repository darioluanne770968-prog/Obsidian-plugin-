import { TFile, Vault, MetadataCache } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';
import { RAGSearch } from './RAGSearch';

export interface DailyBriefing {
  date: string;
  greeting: string;
  todayFocus: string[];
  reviewSuggestions: {
    note: string;
    reason: string;
  }[];
  connections: {
    note1: string;
    note2: string;
    insight: string;
  }[];
  randomInspiration: string;
  writingPrompt: string;
  progress: {
    metric: string;
    value: string;
    trend: 'up' | 'down' | 'stable';
  }[];
  quote: string;
}

export interface WeeklyDigest {
  weekOf: string;
  summary: string;
  topNotes: { title: string; reason: string }[];
  topicsExplored: string[];
  keyInsights: string[];
  nextWeekSuggestions: string[];
  stats: {
    notesCreated: number;
    wordsWritten: number;
    connectionsAdded: number;
  };
}

export class DailyBriefingGenerator {
  private aiService: AIService;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private ragSearch: RAGSearch;

  constructor(
    aiService: AIService,
    vault: Vault,
    metadataCache: MetadataCache,
    ragSearch: RAGSearch
  ) {
    this.aiService = aiService;
    this.vault = vault;
    this.metadataCache = metadataCache;
    this.ragSearch = ragSearch;
  }

  async generateDailyBriefing(): Promise<DailyBriefing> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // Get time-appropriate greeting
    let timeOfDay = 'day';
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    // Get recent notes
    const files = this.vault.getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime);

    const recentNotes = files.slice(0, 5);
    const olderNotes = files.filter(f => {
      const age = (Date.now() - f.stat.mtime) / (1000 * 60 * 60 * 24);
      return age > 7 && age < 60;
    });

    // Pick random older notes to review
    const reviewCandidates = olderNotes
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Get content samples
    const recentContent: string[] = [];
    for (const file of recentNotes) {
      const content = await this.vault.cachedRead(file);
      recentContent.push(`[${file.basename}]\n${content.slice(0, 300)}`);
    }

    // Generate briefing with AI
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a personalized daily briefing for a knowledge worker.

Return JSON:
{
  "greeting": "Good ${timeOfDay}, personalized greeting",
  "todayFocus": ["suggested focus area 1", "suggested focus area 2"],
  "writingPrompt": "an inspiring prompt based on their recent work",
  "randomInspiration": "a thought-provoking idea or question",
  "quote": "a relevant inspirational quote"
}

Be warm, encouraging, and specific to their content.`,
      },
      {
        role: 'user',
        content: `Recent notes:\n${recentContent.join('\n\n')}`,
      },
    ];

    let aiGenerated: any = {
      greeting: `Good ${timeOfDay}!`,
      todayFocus: ['Review recent notes', 'Make new connections'],
      writingPrompt: 'What are you curious about today?',
      randomInspiration: 'Every note is a seed for future ideas.',
      quote: 'Knowledge is power. — Francis Bacon',
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiGenerated = { ...aiGenerated, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Briefing generation failed:', error);
    }

    // Generate review suggestions
    const reviewSuggestions: { note: string; reason: string }[] = [];
    for (const file of reviewCandidates) {
      const daysSinceModified = Math.floor((Date.now() - file.stat.mtime) / (1000 * 60 * 60 * 24));
      reviewSuggestions.push({
        note: file.basename,
        reason: `Not visited in ${daysSinceModified} days`,
      });
    }

    // Find potential connections
    const connections: { note1: string; note2: string; insight: string }[] = [];
    if (recentNotes.length >= 2) {
      try {
        const similar = await this.ragSearch.findSimilarNotes(recentNotes[0].path, 3);
        for (const sim of similar.slice(0, 2)) {
          connections.push({
            note1: recentNotes[0].basename,
            note2: sim.document.title,
            insight: `Similarity score: ${Math.round(sim.score * 100)}%`,
          });
        }
      } catch {
        // Skip if RAG not available
      }
    }

    // Calculate progress metrics
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const todayNotes = files.filter(f =>
      new Date(f.stat.ctime).toISOString().split('T')[0] === today
    ).length;
    const yesterdayNotes = files.filter(f =>
      new Date(f.stat.ctime).toISOString().split('T')[0] === yesterday
    ).length;

    const progress: DailyBriefing['progress'] = [
      {
        metric: 'Notes today',
        value: todayNotes.toString(),
        trend: todayNotes > yesterdayNotes ? 'up' : todayNotes < yesterdayNotes ? 'down' : 'stable',
      },
      {
        metric: 'Total notes',
        value: files.length.toString(),
        trend: 'up',
      },
    ];

    return {
      date: today,
      greeting: aiGenerated.greeting,
      todayFocus: aiGenerated.todayFocus,
      reviewSuggestions,
      connections,
      randomInspiration: aiGenerated.randomInspiration,
      writingPrompt: aiGenerated.writingPrompt,
      progress,
      quote: aiGenerated.quote,
    };
  }

  async generateWeeklyDigest(): Promise<WeeklyDigest> {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const files = this.vault.getMarkdownFiles();
    const thisWeekFiles = files.filter(f => f.stat.ctime > oneWeekAgo);

    // Calculate stats
    let wordsWritten = 0;
    let linksAdded = 0;
    const topicsSet = new Set<string>();

    for (const file of thisWeekFiles) {
      const content = await this.vault.cachedRead(file);
      wordsWritten += content.split(/\s+/).filter(w => w.length > 0).length;

      const cache = this.metadataCache.getFileCache(file);
      linksAdded += cache?.links?.length || 0;

      // Extract folder as topic
      const folder = file.path.split('/')[0];
      if (folder !== file.basename) {
        topicsSet.add(folder);
      }
    }

    // Get content for AI analysis
    const contentSamples: string[] = [];
    for (const file of thisWeekFiles.slice(0, 10)) {
      const content = await this.vault.cachedRead(file);
      contentSamples.push(`[${file.basename}]\n${content.slice(0, 300)}`);
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a weekly digest summary.

Return JSON:
{
  "summary": "1-2 paragraph summary of the week's knowledge work",
  "topNotes": [{"title": "note title", "reason": "why it's notable"}],
  "keyInsights": ["insight 1", "insight 2"],
  "nextWeekSuggestions": ["suggestion 1", "suggestion 2"]
}`,
      },
      {
        role: 'user',
        content: `This week's notes (${thisWeekFiles.length} total):\n${contentSamples.join('\n\n')}`,
      },
    ];

    let aiGenerated: any = {
      summary: `This week you created ${thisWeekFiles.length} notes.`,
      topNotes: [],
      keyInsights: [],
      nextWeekSuggestions: ['Keep writing!'],
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiGenerated = { ...aiGenerated, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Weekly digest failed:', error);
    }

    const weekStart = new Date(oneWeekAgo).toISOString().split('T')[0];

    return {
      weekOf: weekStart,
      summary: aiGenerated.summary,
      topNotes: aiGenerated.topNotes,
      topicsExplored: Array.from(topicsSet),
      keyInsights: aiGenerated.keyInsights,
      nextWeekSuggestions: aiGenerated.nextWeekSuggestions,
      stats: {
        notesCreated: thisWeekFiles.length,
        wordsWritten,
        connectionsAdded: linksAdded,
      },
    };
  }

  formatBriefingAsMarkdown(briefing: DailyBriefing): string {
    const lines: string[] = [
      `# 📰 Daily Briefing - ${briefing.date}`,
      '',
      `## ${briefing.greeting}`,
      '',
      `> "${briefing.quote}"`,
      '',
      '## 🎯 Today\'s Focus',
      ...briefing.todayFocus.map(f => `- ${f}`),
      '',
      '## 📝 Writing Prompt',
      briefing.writingPrompt,
      '',
      '## 💡 Random Inspiration',
      briefing.randomInspiration,
      '',
    ];

    if (briefing.reviewSuggestions.length > 0) {
      lines.push(
        '## 📖 Notes to Review',
        ...briefing.reviewSuggestions.map(r => `- [[${r.note}]] - ${r.reason}`),
        ''
      );
    }

    if (briefing.connections.length > 0) {
      lines.push(
        '## 🔗 Potential Connections',
        ...briefing.connections.map(c => `- [[${c.note1}]] ↔ [[${c.note2}]]: ${c.insight}`),
        ''
      );
    }

    lines.push(
      '## 📊 Progress',
      ...briefing.progress.map(p => {
        const icon = p.trend === 'up' ? '📈' : p.trend === 'down' ? '📉' : '➡️';
        return `- ${p.metric}: **${p.value}** ${icon}`;
      }),
      '',
      '---',
      '*Have a productive day!*'
    );

    return lines.join('\n');
  }

  formatWeeklyDigestAsMarkdown(digest: WeeklyDigest): string {
    return `# 📊 Weekly Digest - Week of ${digest.weekOf}

## Summary
${digest.summary}

## 📈 Stats
| Metric | Value |
|--------|-------|
| Notes Created | ${digest.stats.notesCreated} |
| Words Written | ${digest.stats.wordsWritten.toLocaleString()} |
| Connections Made | ${digest.stats.connectionsAdded} |

## ⭐ Top Notes
${digest.topNotes.map(n => `- **${n.title}**: ${n.reason}`).join('\n')}

## 🏷️ Topics Explored
${digest.topicsExplored.map(t => `- ${t}`).join('\n')}

## 💡 Key Insights
${digest.keyInsights.map(i => `- ${i}`).join('\n')}

## 🎯 Next Week Suggestions
${digest.nextWeekSuggestions.map(s => `- ${s}`).join('\n')}

---
*Keep building your second brain!*`;
  }
}
