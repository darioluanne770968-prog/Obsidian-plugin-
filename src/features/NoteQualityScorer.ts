import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface QualityScore {
  overall: number; // 0-100
  dimensions: {
    completeness: number;
    clarity: number;
    structure: number;
    linkage: number;
    actionability: number;
    uniqueness: number;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface NoteHealth {
  path: string;
  score: QualityScore;
  lastAnalyzed: string;
  issues: NoteIssue[];
  metadata: {
    wordCount: number;
    linkCount: number;
    tagCount: number;
    hasTitle: boolean;
    hasSummary: boolean;
    lastModified: string;
    age: number; // days since creation
  };
}

export interface NoteIssue {
  type: 'orphan' | 'stub' | 'stale' | 'no-links' | 'no-tags' | 'duplicate' | 'unclear' | 'incomplete';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface VaultHealthReport {
  totalNotes: number;
  averageScore: number;
  scoreDistribution: { grade: string; count: number }[];
  topIssues: { type: string; count: number }[];
  orphanedNotes: string[];
  stubNotes: string[];
  staleNotes: string[];
  topPerformers: { path: string; score: number }[];
  needsAttention: { path: string; score: number; reason: string }[];
  recommendations: string[];
}

export class NoteQualityScorer {
  private aiService: AIService;
  private vault: Vault;
  private healthCache: Map<string, NoteHealth> = new Map();

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async scoreNote(file: TFile): Promise<QualityScore> {
    const content = await this.vault.cachedRead(file);
    const metadata = this.analyzeMetadata(file, content);

    // Calculate dimension scores
    const dimensions = {
      completeness: this.scoreCompleteness(content, metadata),
      clarity: 0, // Will be set by AI
      structure: this.scoreStructure(content),
      linkage: this.scoreLinkage(content, metadata),
      actionability: 0, // Will be set by AI
      uniqueness: 0, // Will be set by AI
    };

    // AI analysis for subjective dimensions
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this note's quality on specific dimensions.

Return JSON:
{
  "clarity": 0-100,
  "actionability": 0-100,
  "uniqueness": 0-100,
  "strengths": ["strength 1"],
  "weaknesses": ["weakness 1"],
  "suggestions": ["specific suggestion"]
}

Clarity: Is it easy to understand?
Actionability: Does it provide actionable insights or information?
Uniqueness: Does it offer unique perspectives or information?`,
      },
      {
        role: 'user',
        content: content.slice(0, 4000),
      },
    ];

    let aiAnalysis = {
      clarity: 50,
      actionability: 50,
      uniqueness: 50,
      strengths: [],
      weaknesses: [],
      suggestions: [],
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = { ...aiAnalysis, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('AI quality analysis failed:', error);
    }

    dimensions.clarity = aiAnalysis.clarity;
    dimensions.actionability = aiAnalysis.actionability;
    dimensions.uniqueness = aiAnalysis.uniqueness;

    // Calculate overall score
    const weights = {
      completeness: 0.2,
      clarity: 0.25,
      structure: 0.15,
      linkage: 0.15,
      actionability: 0.15,
      uniqueness: 0.1,
    };

    const overall = Math.round(
      Object.entries(dimensions).reduce(
        (sum, [key, value]) => sum + value * weights[key as keyof typeof weights],
        0
      )
    );

    const grade = this.calculateGrade(overall);

    return {
      overall,
      dimensions,
      strengths: aiAnalysis.strengths,
      weaknesses: aiAnalysis.weaknesses,
      suggestions: aiAnalysis.suggestions,
      grade,
    };
  }

  private analyzeMetadata(file: TFile, content: string): NoteHealth['metadata'] {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const links = content.match(/\[\[.*?\]\]/g) || [];
    const tags = content.match(/#[\w-]+/g) || [];
    const hasTitle = content.startsWith('#') || file.basename.length > 0;
    const hasSummary = content.includes('## Summary') ||
                       content.includes('## Overview') ||
                       content.includes('## TL;DR');

    const creationTime = file.stat.ctime;
    const age = Math.floor((Date.now() - creationTime) / (1000 * 60 * 60 * 24));

    return {
      wordCount: words.length,
      linkCount: links.length,
      tagCount: tags.length,
      hasTitle,
      hasSummary,
      lastModified: new Date(file.stat.mtime).toISOString().split('T')[0],
      age,
    };
  }

  private scoreCompleteness(content: string, metadata: NoteHealth['metadata']): number {
    let score = 0;

    // Word count contribution
    if (metadata.wordCount >= 500) score += 40;
    else if (metadata.wordCount >= 200) score += 30;
    else if (metadata.wordCount >= 50) score += 20;
    else score += 10;

    // Has title
    if (metadata.hasTitle) score += 15;

    // Has summary
    if (metadata.hasSummary) score += 15;

    // Has structure (multiple headings)
    const headingCount = (content.match(/^#+\s/gm) || []).length;
    if (headingCount >= 3) score += 15;
    else if (headingCount >= 1) score += 10;

    // Has tags
    if (metadata.tagCount > 0) score += 15;

    return Math.min(100, score);
  }

  private scoreStructure(content: string): number {
    let score = 0;

    // Check for headings
    const headings = content.match(/^#+\s/gm) || [];
    if (headings.length >= 3) score += 30;
    else if (headings.length >= 1) score += 20;

    // Check for lists
    const lists = content.match(/^[-*]\s/gm) || [];
    if (lists.length >= 5) score += 20;
    else if (lists.length >= 1) score += 10;

    // Check for code blocks
    if (content.includes('```')) score += 10;

    // Check for paragraphs (blank lines)
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    if (paragraphs.length >= 3) score += 20;
    else if (paragraphs.length >= 2) score += 10;

    // Check for emphasis
    if (content.match(/\*\*.*?\*\*|\*.*?\*/)) score += 10;

    // Check for tables
    if (content.includes('|')) score += 10;

    return Math.min(100, score);
  }

  private scoreLinkage(content: string, metadata: NoteHealth['metadata']): number {
    let score = 0;

    // Internal links
    if (metadata.linkCount >= 5) score += 40;
    else if (metadata.linkCount >= 3) score += 30;
    else if (metadata.linkCount >= 1) score += 20;

    // External links
    const externalLinks = content.match(/\[.*?\]\(http.*?\)/g) || [];
    if (externalLinks.length >= 3) score += 20;
    else if (externalLinks.length >= 1) score += 10;

    // Tags
    if (metadata.tagCount >= 3) score += 20;
    else if (metadata.tagCount >= 1) score += 10;

    // Backlinks potential (mentions of other concepts)
    const potentialLinks = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
    if (potentialLinks.length >= 3) score += 20;
    else if (potentialLinks.length >= 1) score += 10;

    return Math.min(100, score);
  }

  private calculateGrade(score: number): QualityScore['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  async identifyIssues(file: TFile): Promise<NoteIssue[]> {
    const content = await this.vault.cachedRead(file);
    const metadata = this.analyzeMetadata(file, content);
    const issues: NoteIssue[] = [];

    // Check for stub (very short)
    if (metadata.wordCount < 50) {
      issues.push({
        type: 'stub',
        severity: 'medium',
        description: 'Note is very short and may be incomplete',
        suggestion: 'Expand this note with more details and context',
      });
    }

    // Check for no links
    if (metadata.linkCount === 0) {
      issues.push({
        type: 'no-links',
        severity: 'low',
        description: 'Note has no internal links',
        suggestion: 'Add links to related notes to improve discoverability',
      });
    }

    // Check for no tags
    if (metadata.tagCount === 0) {
      issues.push({
        type: 'no-tags',
        severity: 'low',
        description: 'Note has no tags',
        suggestion: 'Add relevant tags for better organization',
      });
    }

    // Check for stale content
    const daysSinceModified = (Date.now() - file.stat.mtime) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 180 && metadata.wordCount > 100) {
      issues.push({
        type: 'stale',
        severity: 'low',
        description: `Note hasn't been updated in ${Math.round(daysSinceModified)} days`,
        suggestion: 'Review and update this note with any new information',
      });
    }

    // Check for orphan (no backlinks) - would need full vault analysis

    return issues;
  }

  async generateVaultHealthReport(): Promise<VaultHealthReport> {
    const files = this.vault.getMarkdownFiles();
    const scores: { path: string; score: number; grade: string }[] = [];
    const allIssues: Map<string, number> = new Map();
    const orphanedNotes: string[] = [];
    const stubNotes: string[] = [];
    const staleNotes: string[] = [];

    // Build backlink map
    const backlinks: Map<string, number> = new Map();
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      const links = content.match(/\[\[(.*?)\]\]/g) || [];
      for (const link of links) {
        const target = link.slice(2, -2).split('|')[0];
        backlinks.set(target, (backlinks.get(target) || 0) + 1);
      }
    }

    // Analyze each note (sample for large vaults)
    const sampled = files.slice(0, 100);
    for (const file of sampled) {
      const quality = await this.scoreNote(file);
      scores.push({ path: file.path, score: quality.overall, grade: quality.grade });

      const issues = await this.identifyIssues(file);
      for (const issue of issues) {
        allIssues.set(issue.type, (allIssues.get(issue.type) || 0) + 1);

        if (issue.type === 'stub') stubNotes.push(file.path);
        if (issue.type === 'stale') staleNotes.push(file.path);
      }

      // Check orphan
      if (!backlinks.has(file.basename) && !backlinks.has(file.path)) {
        orphanedNotes.push(file.path);
      }

      // Cache the health
      this.healthCache.set(file.path, {
        path: file.path,
        score: quality,
        lastAnalyzed: new Date().toISOString().split('T')[0],
        issues,
        metadata: this.analyzeMetadata(file, await this.vault.cachedRead(file)),
      });
    }

    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;

    // Grade distribution
    const gradeCount: Map<string, number> = new Map();
    for (const s of scores) {
      gradeCount.set(s.grade, (gradeCount.get(s.grade) || 0) + 1);
    }

    // Top performers and needs attention
    scores.sort((a, b) => b.score - a.score);
    const topPerformers = scores.slice(0, 10).map(s => ({ path: s.path, score: s.score }));
    const needsAttention = scores
      .filter(s => s.score < 50)
      .slice(0, 10)
      .map(s => ({ path: s.path, score: s.score, reason: `Low quality score (${s.score})` }));

    // Generate recommendations
    const recommendations = await this.generateRecommendations({
      averageScore,
      orphanCount: orphanedNotes.length,
      stubCount: stubNotes.length,
      staleCount: staleNotes.length,
      totalNotes: files.length,
    });

    return {
      totalNotes: files.length,
      averageScore: Math.round(averageScore),
      scoreDistribution: Array.from(gradeCount.entries())
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => a.grade.localeCompare(b.grade)),
      topIssues: Array.from(allIssues.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count })),
      orphanedNotes: orphanedNotes.slice(0, 20),
      stubNotes: stubNotes.slice(0, 20),
      staleNotes: staleNotes.slice(0, 20),
      topPerformers,
      needsAttention,
      recommendations,
    };
  }

  private async generateRecommendations(stats: {
    averageScore: number;
    orphanCount: number;
    stubCount: number;
    staleCount: number;
    totalNotes: number;
  }): Promise<string[]> {
    const recommendations: string[] = [];

    if (stats.orphanCount > stats.totalNotes * 0.3) {
      recommendations.push('Many notes are orphaned - consider adding links to connect them');
    }

    if (stats.stubCount > stats.totalNotes * 0.2) {
      recommendations.push('Several stub notes exist - expand them or merge with related notes');
    }

    if (stats.staleCount > stats.totalNotes * 0.4) {
      recommendations.push('Many notes are stale - schedule time to review and update old content');
    }

    if (stats.averageScore < 60) {
      recommendations.push('Overall note quality is low - focus on adding structure and links');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your vault is in good health! Keep up the good work.');
    }

    return recommendations;
  }

  async getImprovementPlan(filePath: string): Promise<{
    currentScore: number;
    targetScore: number;
    steps: { action: string; impact: string; effort: string }[];
    estimatedTime: string;
  }> {
    const file = this.vault.getAbstractFileByPath(filePath) as TFile;
    if (!file) {
      throw new Error('File not found');
    }

    const score = await this.scoreNote(file);
    const content = await this.vault.cachedRead(file);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Create an improvement plan for this note.

Current scores:
- Overall: ${score.overall}
- Completeness: ${score.dimensions.completeness}
- Clarity: ${score.dimensions.clarity}
- Structure: ${score.dimensions.structure}
- Linkage: ${score.dimensions.linkage}
- Actionability: ${score.dimensions.actionability}

Return JSON:
{
  "steps": [
    {"action": "specific action", "impact": "expected improvement", "effort": "low|medium|high"}
  ],
  "estimatedTime": "time to complete all steps"
}`,
      },
      {
        role: 'user',
        content: content.slice(0, 3000),
      },
    ];

    let plan = { steps: [], estimatedTime: '30 minutes' };
    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = { ...plan, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Plan generation failed:', error);
    }

    return {
      currentScore: score.overall,
      targetScore: Math.min(100, score.overall + 20),
      steps: plan.steps,
      estimatedTime: plan.estimatedTime,
    };
  }

  formatReportAsMarkdown(report: VaultHealthReport): string {
    return `# 📋 Vault Health Report

## Overview
| Metric | Value |
|--------|-------|
| Total Notes | ${report.totalNotes} |
| Average Score | ${report.averageScore}/100 |
| Orphaned Notes | ${report.orphanedNotes.length} |
| Stub Notes | ${report.stubNotes.length} |
| Stale Notes | ${report.staleNotes.length} |

## Grade Distribution
${report.scoreDistribution.map(d => `- **Grade ${d.grade}:** ${d.count} notes`).join('\n')}

## Top Issues
${report.topIssues.map(i => `- **${i.type}:** ${i.count} notes`).join('\n')}

## 🌟 Top Performers
${report.topPerformers.map(n => `1. ${n.path} (${n.score}/100)`).join('\n')}

## ⚠️ Needs Attention
${report.needsAttention.map(n => `- ${n.path}: ${n.reason}`).join('\n') || 'All notes are in good shape!'}

## 💡 Recommendations
${report.recommendations.map(r => `- ${r}`).join('\n')}
`;
  }

  getHealthCache(): Map<string, NoteHealth> {
    return new Map(this.healthCache);
  }

  setHealthCache(cache: [string, NoteHealth][]): void {
    this.healthCache = new Map(cache);
  }
}
