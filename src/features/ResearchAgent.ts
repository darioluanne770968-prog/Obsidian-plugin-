import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';
import { RAGSearch } from './RAGSearch';

export interface ResearchStep {
  type: 'search' | 'analyze' | 'synthesize' | 'verify' | 'expand';
  query: string;
  result: string;
  sources: string[];
  timestamp: number;
}

export interface ResearchReport {
  topic: string;
  summary: string;
  keyFindings: string[];
  sources: { path: string; relevance: string }[];
  gaps: string[];
  suggestedNextSteps: string[];
  steps: ResearchStep[];
  confidence: number;
}

export interface AgentThought {
  thought: string;
  action: string;
  observation: string;
}

export class ResearchAgent {
  private aiService: AIService;
  private ragSearch: RAGSearch;
  private vault: Vault;
  private maxIterations: number = 10;

  constructor(aiService: AIService, ragSearch: RAGSearch, vault: Vault) {
    this.aiService = aiService;
    this.ragSearch = ragSearch;
    this.vault = vault;
  }

  async research(
    topic: string,
    options?: {
      depth?: 'shallow' | 'medium' | 'deep';
      onProgress?: (step: ResearchStep) => void;
      onThought?: (thought: AgentThought) => void;
    }
  ): Promise<ResearchReport> {
    const depth = options?.depth || 'medium';
    const maxSteps = depth === 'shallow' ? 3 : depth === 'medium' ? 6 : 10;
    const steps: ResearchStep[] = [];
    const allSources: Map<string, { path: string; relevance: string }> = new Map();

    // Step 1: Initial search
    const initialSearch = await this.searchStep(topic, 'Initial exploration');
    steps.push(initialSearch);
    options?.onProgress?.(initialSearch);
    initialSearch.sources.forEach(s => allSources.set(s, { path: s, relevance: 'primary' }));

    // Step 2: Analyze initial findings and generate sub-questions
    const subQuestions = await this.generateSubQuestions(topic, initialSearch.result);

    // Step 3: Research each sub-question
    for (let i = 0; i < Math.min(subQuestions.length, maxSteps - 2); i++) {
      const question = subQuestions[i];

      options?.onThought?.({
        thought: `Investigating: ${question}`,
        action: 'search',
        observation: 'Searching knowledge base...',
      });

      const searchStep = await this.searchStep(question, `Sub-question ${i + 1}`);
      steps.push(searchStep);
      options?.onProgress?.(searchStep);
      searchStep.sources.forEach(s => allSources.set(s, { path: s, relevance: 'supporting' }));

      // Check if we should go deeper
      if (depth === 'deep' && searchStep.result.includes('unclear') || searchStep.result.includes('需要更多')) {
        const deeperQuestions = await this.generateFollowUpQuestions(question, searchStep.result);
        for (const deepQ of deeperQuestions.slice(0, 2)) {
          const deepStep = await this.searchStep(deepQ, 'Deep dive');
          steps.push(deepStep);
          options?.onProgress?.(deepStep);
          deepStep.sources.forEach(s => allSources.set(s, { path: s, relevance: 'supplementary' }));
        }
      }
    }

    // Step 4: Synthesize findings
    const synthesis = await this.synthesizeFindings(topic, steps);
    steps.push({
      type: 'synthesize',
      query: 'Synthesizing all findings',
      result: synthesis,
      sources: [],
      timestamp: Date.now(),
    });

    // Step 5: Identify gaps and next steps
    const { gaps, nextSteps } = await this.identifyGapsAndNextSteps(topic, synthesis);

    // Step 6: Calculate confidence
    const confidence = this.calculateConfidence(steps, allSources.size);

    // Step 7: Generate final report
    const keyFindings = await this.extractKeyFindings(synthesis);

    return {
      topic,
      summary: synthesis,
      keyFindings,
      sources: Array.from(allSources.values()),
      gaps,
      suggestedNextSteps: nextSteps,
      steps,
      confidence,
    };
  }

  private async searchStep(query: string, context: string): Promise<ResearchStep> {
    const results = await this.ragSearch.search(query, 5);

    if (results.length === 0) {
      return {
        type: 'search',
        query,
        result: `No relevant information found for: ${query}`,
        sources: [],
        timestamp: Date.now(),
      };
    }

    // Analyze the search results
    const contextText = results
      .map(r => `[${r.document.title}]\n${r.document.content}`)
      .join('\n\n---\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a research analyst. Analyze the provided sources and extract relevant information for the query. Be thorough but concise. Cite which sources contain which information.`,
      },
      {
        role: 'user',
        content: `Context: ${context}\n\nQuery: ${query}\n\nSources:\n${contextText}`,
      },
    ];

    const response = await this.aiService.chat(messages);

    return {
      type: 'search',
      query,
      result: response.content,
      sources: results.map(r => r.document.path),
      timestamp: Date.now(),
    };
  }

  private async generateSubQuestions(topic: string, initialFindings: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a research planner. Given a topic and initial findings, generate follow-up questions that would deepen understanding. Return 3-5 specific questions, one per line.`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nInitial findings:\n${initialFindings}\n\nGenerate follow-up research questions:`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .map(q => q.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter(q => q.length > 10);
  }

  private async generateFollowUpQuestions(question: string, findings: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate 2 specific follow-up questions to clarify or expand on the findings. One question per line.`,
      },
      {
        role: 'user',
        content: `Original question: ${question}\n\nFindings: ${findings}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .map(q => q.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 5);
  }

  private async synthesizeFindings(topic: string, steps: ResearchStep[]): Promise<string> {
    const allFindings = steps
      .filter(s => s.type === 'search' && s.result)
      .map(s => s.result)
      .join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a research synthesizer. Combine all findings into a coherent, well-structured summary. Identify patterns, connections, and key insights. Write in a clear, professional style.`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nAll research findings:\n${allFindings}\n\nSynthesize into a comprehensive summary:`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  private async identifyGapsAndNextSteps(topic: string, synthesis: string): Promise<{ gaps: string[]; nextSteps: string[] }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze the research synthesis and identify:
1. Knowledge gaps - What's missing or unclear?
2. Next steps - What should be researched further?

Return JSON: {"gaps": ["gap1", "gap2"], "nextSteps": ["step1", "step2"]}`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nSynthesis:\n${synthesis}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back to empty
    }

    return { gaps: [], nextSteps: [] };
  }

  private async extractKeyFindings(synthesis: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Extract 5-7 key findings from the synthesis. Each finding should be a concise, standalone insight. Return as bullet points, one per line.`,
      },
      {
        role: 'user',
        content: synthesis,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .map(f => f.replace(/^[-•*]\s*/, '').trim())
      .filter(f => f.length > 10);
  }

  private calculateConfidence(steps: ResearchStep[], sourceCount: number): number {
    const searchSteps = steps.filter(s => s.type === 'search');
    const successfulSearches = searchSteps.filter(s => s.sources.length > 0).length;

    const searchSuccessRate = searchSteps.length > 0 ? successfulSearches / searchSteps.length : 0;
    const sourceScore = Math.min(sourceCount / 10, 1);

    return Math.round((searchSuccessRate * 0.6 + sourceScore * 0.4) * 100) / 100;
  }

  formatReportAsMarkdown(report: ResearchReport): string {
    const lines: string[] = [
      `# Research Report: ${report.topic}`,
      '',
      `> **Confidence:** ${Math.round(report.confidence * 100)}%`,
      `> **Sources:** ${report.sources.length} notes consulted`,
      '',
      '## Executive Summary',
      '',
      report.summary,
      '',
      '## Key Findings',
      '',
      ...report.keyFindings.map(f => `- ${f}`),
      '',
    ];

    if (report.gaps.length > 0) {
      lines.push('## Knowledge Gaps', '', ...report.gaps.map(g => `- ⚠️ ${g}`), '');
    }

    if (report.suggestedNextSteps.length > 0) {
      lines.push('## Suggested Next Steps', '', ...report.suggestedNextSteps.map(s => `- [ ] ${s}`), '');
    }

    lines.push(
      '## Sources',
      '',
      ...report.sources.map(s => `- [[${s.path.replace('.md', '')}]] *(${s.relevance})*`),
      '',
      '---',
      `*Report generated at ${new Date().toISOString()}*`,
    );

    return lines.join('\n');
  }
}

// Multi-Agent Debate System
export class DebateAgent {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async debate(
    topic: string,
    perspectives: string[],
    rounds: number = 3
  ): Promise<{
    rounds: { perspective: string; argument: string }[][];
    synthesis: string;
    verdict: string;
  }> {
    const allRounds: { perspective: string; argument: string }[][] = [];
    let context = '';

    for (let round = 0; round < rounds; round++) {
      const roundArguments: { perspective: string; argument: string }[] = [];

      for (const perspective of perspectives) {
        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: `You are arguing from the perspective: "${perspective}".

Round ${round + 1} of ${rounds}.
${round > 0 ? 'Consider and respond to previous arguments.' : 'Present your opening argument.'}

Be articulate, logical, and persuasive. Keep arguments focused and under 200 words.`,
          },
          {
            role: 'user',
            content: `Topic: ${topic}${context ? `\n\nPrevious arguments:\n${context}` : ''}\n\nPresent your argument:`,
          },
        ];

        const response = await this.aiService.chat(messages);
        roundArguments.push({
          perspective,
          argument: response.content,
        });
      }

      allRounds.push(roundArguments);
      context = roundArguments.map(a => `[${a.perspective}]: ${a.argument}`).join('\n\n');
    }

    // Synthesize the debate
    const synthesisMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a neutral moderator. Synthesize the debate, identify common ground, key disagreements, and provide a balanced verdict.`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nFull debate:\n${allRounds.map((round, i) =>
          `### Round ${i + 1}\n${round.map(a => `**${a.perspective}:** ${a.argument}`).join('\n\n')}`
        ).join('\n\n')}`,
      },
    ];

    const synthesisResponse = await this.aiService.chat(synthesisMessages);
    const parts = synthesisResponse.content.split(/verdict|conclusion/i);

    return {
      rounds: allRounds,
      synthesis: parts[0]?.trim() || synthesisResponse.content,
      verdict: parts[1]?.trim() || 'See synthesis for balanced conclusion.',
    };
  }

  formatDebateAsMarkdown(
    topic: string,
    debate: { rounds: { perspective: string; argument: string }[][]; synthesis: string; verdict: string }
  ): string {
    const lines: string[] = [
      `# AI Debate: ${topic}`,
      '',
    ];

    debate.rounds.forEach((round, i) => {
      lines.push(`## Round ${i + 1}`, '');
      round.forEach(arg => {
        lines.push(`### 🎭 ${arg.perspective}`, '', arg.argument, '');
      });
    });

    lines.push(
      '## 🤝 Synthesis',
      '',
      debate.synthesis,
      '',
      '## ⚖️ Verdict',
      '',
      debate.verdict,
    );

    return lines.join('\n');
  }
}
