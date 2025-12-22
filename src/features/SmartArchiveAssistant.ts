import { TFile, TFolder, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface ArchiveCandidate {
  path: string;
  reason: string;
  confidence: number;
  suggestedAction: 'archive' | 'delete' | 'merge' | 'keep';
  lastModified: string;
  wordCount: number;
  linkCount: number;
  backlinks: number;
}

export interface MergeCandidate {
  notes: string[];
  similarity: number;
  suggestedTitle: string;
  reason: string;
}

export interface OrganizationSuggestion {
  note: string;
  currentLocation: string;
  suggestedLocation: string;
  reason: string;
  confidence: number;
}

export interface DuplicateGroup {
  original: string;
  duplicates: { path: string; similarity: number }[];
  suggestedAction: 'keep-original' | 'merge' | 'keep-both';
}

export interface CleanupReport {
  totalNotes: number;
  archiveCandidates: ArchiveCandidate[];
  mergeCandidates: MergeCandidate[];
  duplicates: DuplicateGroup[];
  organizationSuggestions: OrganizationSuggestion[];
  potentialSavings: {
    notesToArchive: number;
    notesToMerge: number;
    duplicatesToRemove: number;
  };
  healthScore: number;
}

export class SmartArchiveAssistant {
  private aiService: AIService;
  private vault: Vault;
  private archiveFolder: string = 'Archive';

  constructor(aiService: AIService, vault: Vault, archiveFolder?: string) {
    this.aiService = aiService;
    this.vault = vault;
    if (archiveFolder) {
      this.archiveFolder = archiveFolder;
    }
  }

  async findArchiveCandidates(): Promise<ArchiveCandidate[]> {
    const files = this.vault.getMarkdownFiles();
    const candidates: ArchiveCandidate[] = [];
    const now = Date.now();

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

    for (const file of files) {
      // Skip files already in archive
      if (file.path.startsWith(this.archiveFolder)) continue;

      const content = await this.vault.cachedRead(file);
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const linkCount = (content.match(/\[\[.*?\]\]/g) || []).length;
      const backlinksCount = backlinks.get(file.basename) || 0;
      const daysSinceModified = (now - file.stat.mtime) / (1000 * 60 * 60 * 24);
      const lastModified = new Date(file.stat.mtime).toISOString().split('T')[0];

      let shouldArchive = false;
      let reason = '';
      let confidence = 0;
      let action: ArchiveCandidate['suggestedAction'] = 'keep';

      // Stale and disconnected
      if (daysSinceModified > 365 && backlinksCount === 0 && linkCount === 0) {
        shouldArchive = true;
        reason = 'Stale note with no connections (>1 year old)';
        confidence = 0.9;
        action = 'archive';
      }
      // Very stale
      else if (daysSinceModified > 730) {
        shouldArchive = true;
        reason = 'Very old note (>2 years without modification)';
        confidence = 0.7;
        action = 'archive';
      }
      // Stub with no activity
      else if (wordCount < 30 && daysSinceModified > 180) {
        shouldArchive = true;
        reason = 'Stub note with no recent activity';
        confidence = 0.8;
        action = wordCount < 10 ? 'delete' : 'archive';
      }
      // Orphan
      else if (backlinksCount === 0 && linkCount === 0 && daysSinceModified > 90) {
        shouldArchive = true;
        reason = 'Orphaned note with no connections';
        confidence = 0.6;
        action = 'archive';
      }

      if (shouldArchive) {
        candidates.push({
          path: file.path,
          reason,
          confidence,
          suggestedAction: action,
          lastModified,
          wordCount,
          linkCount,
          backlinks: backlinksCount,
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  async findMergeCandidates(): Promise<MergeCandidate[]> {
    const files = this.vault.getMarkdownFiles();
    const candidates: MergeCandidate[] = [];
    const processed: Set<string> = new Set();

    // Group by similar titles
    const titleGroups: Map<string, TFile[]> = new Map();
    for (const file of files) {
      const normalized = file.basename.toLowerCase()
        .replace(/[0-9]+/g, '')
        .replace(/[-_]/g, ' ')
        .trim();

      if (normalized.length > 3) {
        const existing = titleGroups.get(normalized) || [];
        existing.push(file);
        titleGroups.set(normalized, existing);
      }
    }

    // Find groups with multiple files
    for (const [_, group] of titleGroups) {
      if (group.length >= 2 && group.length <= 5) {
        const paths = group.map(f => f.path);
        if (paths.some(p => processed.has(p))) continue;

        // Get content summaries for AI analysis
        const contents = await Promise.all(
          group.map(async f => ({
            path: f.path,
            content: (await this.vault.cachedRead(f)).slice(0, 500),
          }))
        );

        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: `Determine if these notes should be merged.

Return JSON:
{
  "shouldMerge": true/false,
  "similarity": 0.0-1.0,
  "suggestedTitle": "merged note title",
  "reason": "why merge or not"
}`,
          },
          {
            role: 'user',
            content: contents.map(c => `File: ${c.path}\nContent: ${c.content}`).join('\n\n'),
          },
        ];

        try {
          const response = await this.aiService.chat(messages);
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            if (analysis.shouldMerge && analysis.similarity > 0.6) {
              candidates.push({
                notes: paths,
                similarity: analysis.similarity,
                suggestedTitle: analysis.suggestedTitle,
                reason: analysis.reason,
              });
              paths.forEach(p => processed.add(p));
            }
          }
        } catch (error) {
          console.error('Merge analysis failed:', error);
        }
      }
    }

    return candidates;
  }

  async findDuplicates(): Promise<DuplicateGroup[]> {
    const files = this.vault.getMarkdownFiles();
    const duplicates: DuplicateGroup[] = [];
    const contentHashes: Map<string, TFile[]> = new Map();

    // Simple content-based grouping
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      // Create simple hash based on first 500 chars and length
      const hash = `${content.slice(0, 500).replace(/\s+/g, '')}|${content.length}`;

      const existing = contentHashes.get(hash) || [];
      existing.push(file);
      contentHashes.set(hash, existing);
    }

    // Find groups with potential duplicates
    for (const [_, group] of contentHashes) {
      if (group.length >= 2) {
        const sorted = group.sort((a, b) => a.stat.ctime - b.stat.ctime);
        const original = sorted[0];
        const dupes = sorted.slice(1).map(f => ({
          path: f.path,
          similarity: 0.95,
        }));

        duplicates.push({
          original: original.path,
          duplicates: dupes,
          suggestedAction: 'keep-original',
        });
      }
    }

    return duplicates;
  }

  async suggestOrganization(): Promise<OrganizationSuggestion[]> {
    const files = this.vault.getMarkdownFiles();
    const suggestions: OrganizationSuggestion[] = [];

    // Get existing folder structure
    const folders = new Set<string>();
    for (const file of files) {
      const folder = file.path.split('/').slice(0, -1).join('/');
      if (folder) folders.add(folder);
    }

    // Analyze misplaced files
    const sampled = files.slice(0, 50);
    for (const file of sampled) {
      const content = await this.vault.cachedRead(file);
      const currentFolder = file.path.split('/').slice(0, -1).join('/') || 'root';

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `Based on this note's content and existing folders, suggest if it should be moved.

Existing folders: ${Array.from(folders).slice(0, 20).join(', ')}

Return JSON:
{
  "shouldMove": true/false,
  "suggestedFolder": "folder path",
  "reason": "why move or keep",
  "confidence": 0.0-1.0
}`,
        },
        {
          role: 'user',
          content: `File: ${file.path}\nContent: ${content.slice(0, 1000)}`,
        },
      ];

      try {
        const response = await this.aiService.chat(messages);
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          if (analysis.shouldMove && analysis.confidence > 0.7) {
            suggestions.push({
              note: file.path,
              currentLocation: currentFolder,
              suggestedLocation: analysis.suggestedFolder,
              reason: analysis.reason,
              confidence: analysis.confidence,
            });
          }
        }
      } catch (error) {
        console.error('Organization analysis failed:', error);
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  async generateCleanupReport(): Promise<CleanupReport> {
    const files = this.vault.getMarkdownFiles();

    const [archiveCandidates, mergeCandidates, duplicates, organizationSuggestions] =
      await Promise.all([
        this.findArchiveCandidates(),
        this.findMergeCandidates(),
        this.findDuplicates(),
        this.suggestOrganization(),
      ]);

    const healthScore = this.calculateHealthScore({
      totalNotes: files.length,
      archiveCandidates: archiveCandidates.length,
      duplicates: duplicates.length,
      misorganized: organizationSuggestions.length,
    });

    return {
      totalNotes: files.length,
      archiveCandidates,
      mergeCandidates,
      duplicates,
      organizationSuggestions,
      potentialSavings: {
        notesToArchive: archiveCandidates.length,
        notesToMerge: mergeCandidates.reduce((sum, c) => sum + c.notes.length - 1, 0),
        duplicatesToRemove: duplicates.reduce((sum, d) => sum + d.duplicates.length, 0),
      },
      healthScore,
    };
  }

  private calculateHealthScore(stats: {
    totalNotes: number;
    archiveCandidates: number;
    duplicates: number;
    misorganized: number;
  }): number {
    if (stats.totalNotes === 0) return 100;

    const archiveRatio = stats.archiveCandidates / stats.totalNotes;
    const duplicateRatio = stats.duplicates / stats.totalNotes;
    const misorgRatio = stats.misorganized / stats.totalNotes;

    let score = 100;
    score -= archiveRatio * 30;
    score -= duplicateRatio * 40;
    score -= misorgRatio * 30;

    return Math.max(0, Math.round(score));
  }

  async archiveNote(filePath: string): Promise<string> {
    const file = this.vault.getAbstractFileByPath(filePath) as TFile;
    if (!file) {
      throw new Error('File not found');
    }

    // Ensure archive folder exists
    const archivePath = this.archiveFolder;
    let archiveFolder = this.vault.getAbstractFileByPath(archivePath);
    if (!archiveFolder) {
      await this.vault.createFolder(archivePath);
    }

    // Generate new path
    const newPath = `${archivePath}/${file.name}`;

    // Move the file
    await this.vault.rename(file, newPath);

    return newPath;
  }

  async mergeNotes(notePaths: string[], newTitle: string): Promise<string> {
    const contents: string[] = [];

    for (const path of notePaths) {
      const file = this.vault.getAbstractFileByPath(path) as TFile;
      if (file) {
        const content = await this.vault.cachedRead(file);
        contents.push(`## From: ${file.basename}\n\n${content}`);
      }
    }

    // Create merged note
    const mergedContent = `# ${newTitle}\n\n*Merged from: ${notePaths.map(p => p.split('/').pop()).join(', ')}*\n\n${contents.join('\n\n---\n\n')}`;

    const folder = notePaths[0].split('/').slice(0, -1).join('/');
    const newPath = folder ? `${folder}/${newTitle}.md` : `${newTitle}.md`;

    await this.vault.create(newPath, mergedContent);

    // Optionally archive original notes
    for (const path of notePaths) {
      await this.archiveNote(path);
    }

    return newPath;
  }

  async deleteDuplicates(group: DuplicateGroup): Promise<void> {
    for (const duplicate of group.duplicates) {
      const file = this.vault.getAbstractFileByPath(duplicate.path) as TFile;
      if (file) {
        await this.vault.trash(file, true);
      }
    }
  }

  async reorganizeNote(
    notePath: string,
    newFolder: string
  ): Promise<string> {
    const file = this.vault.getAbstractFileByPath(notePath) as TFile;
    if (!file) {
      throw new Error('File not found');
    }

    // Ensure target folder exists
    let targetFolder = this.vault.getAbstractFileByPath(newFolder);
    if (!targetFolder) {
      await this.vault.createFolder(newFolder);
    }

    const newPath = `${newFolder}/${file.name}`;
    await this.vault.rename(file, newPath);

    return newPath;
  }

  formatReportAsMarkdown(report: CleanupReport): string {
    return `# 🧹 Vault Cleanup Report

## Health Score: ${report.healthScore}/100

## Overview
| Metric | Count |
|--------|-------|
| Total Notes | ${report.totalNotes} |
| Archive Candidates | ${report.archiveCandidates.length} |
| Merge Candidates | ${report.mergeCandidates.length} |
| Duplicates Found | ${report.duplicates.length} |
| Organization Suggestions | ${report.organizationSuggestions.length} |

## Potential Savings
- Notes to archive: ${report.potentialSavings.notesToArchive}
- Notes to merge: ${report.potentialSavings.notesToMerge}
- Duplicates to remove: ${report.potentialSavings.duplicatesToRemove}

## 📦 Archive Candidates
${report.archiveCandidates.slice(0, 10).map(c =>
  `- **${c.path}** (${c.suggestedAction})\n  - Reason: ${c.reason}\n  - Confidence: ${Math.round(c.confidence * 100)}%`
).join('\n') || 'No candidates found'}

## 🔗 Merge Candidates
${report.mergeCandidates.slice(0, 5).map(c =>
  `- **${c.suggestedTitle}**\n  - Notes: ${c.notes.join(', ')}\n  - Similarity: ${Math.round(c.similarity * 100)}%\n  - Reason: ${c.reason}`
).join('\n') || 'No candidates found'}

## 📄 Duplicates
${report.duplicates.slice(0, 5).map(d =>
  `- Original: **${d.original}**\n  - Duplicates: ${d.duplicates.map(dup => dup.path).join(', ')}`
).join('\n') || 'No duplicates found'}

## 📁 Organization Suggestions
${report.organizationSuggestions.slice(0, 10).map(s =>
  `- **${s.note}**\n  - From: ${s.currentLocation}\n  - To: ${s.suggestedLocation}\n  - Reason: ${s.reason}`
).join('\n') || 'All notes are well organized'}
`;
  }

  setArchiveFolder(folder: string): void {
    this.archiveFolder = folder;
  }
}
