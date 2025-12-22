import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface Decision {
  id: string;
  date: string;
  title: string;
  context: string;
  options: {
    option: string;
    pros: string[];
    cons: string[];
    probability?: number;
  }[];
  chosenOption: string;
  reasoning: string;
  expectedOutcome: string;
  actualOutcome?: string;
  reviewDate?: string;
  tags: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  stakeholders: string[];
  reversibility: 'reversible' | 'partially-reversible' | 'irreversible';
  timeframe: 'immediate' | 'short-term' | 'long-term';
  confidenceLevel: number; // 0-1
  emotionalState?: string;
  lessonsLearned?: string[];
}

export interface DecisionReview {
  decisionId: string;
  reviewDate: string;
  outcomeAccuracy: number; // -1 to 1
  whatWorked: string[];
  whatDidntWork: string[];
  unexpectedConsequences: string[];
  wouldDecideDifferently: boolean;
  alternativeInHindsight?: string;
  keyLearnings: string[];
}

export interface DecisionPattern {
  pattern: string;
  frequency: number;
  outcomes: { positive: number; negative: number; neutral: number };
  recommendation: string;
}

export interface DecisionAnalytics {
  totalDecisions: number;
  byCategory: { category: string; count: number }[];
  byImportance: { importance: string; count: number }[];
  accuracyRate: number;
  commonBiases: string[];
  strengthAreas: string[];
  improvementAreas: string[];
  patterns: DecisionPattern[];
}

export class DecisionJournal {
  private aiService: AIService;
  private vault: Vault;
  private decisions: Decision[] = [];
  private reviews: DecisionReview[] = [];

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async createDecision(
    title: string,
    context: string,
    options: string[]
  ): Promise<Decision> {
    const id = `dec_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Analyze options with AI
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze these decision options objectively.

Return JSON:
{
  "options": [
    {"option": "option text", "pros": ["pro1"], "cons": ["con1"], "probability": 0.0-1.0}
  ],
  "suggestedCategory": "category name",
  "potentialBiases": ["bias to watch for"],
  "importantConsiderations": ["consideration 1"]
}

Be thorough and balanced.`,
      },
      {
        role: 'user',
        content: `Decision: ${title}\n\nContext: ${context}\n\nOptions:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
      },
    ];

    let analysis = {
      options: options.map(o => ({ option: o, pros: [], cons: [], probability: 0.5 })),
      suggestedCategory: 'General',
      potentialBiases: [],
      importantConsiderations: [],
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Decision analysis failed:', error);
    }

    const decision: Decision = {
      id,
      date: new Date().toISOString().split('T')[0],
      title,
      context,
      options: analysis.options,
      chosenOption: '',
      reasoning: '',
      expectedOutcome: '',
      tags: [],
      importance: 'medium',
      category: analysis.suggestedCategory,
      stakeholders: [],
      reversibility: 'reversible',
      timeframe: 'short-term',
      confidenceLevel: 0.5,
    };

    this.decisions.push(decision);
    return decision;
  }

  async finalizeDecision(
    decisionId: string,
    chosenOption: string,
    reasoning: string,
    expectedOutcome: string,
    reviewInDays: number = 30
  ): Promise<Decision> {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    decision.chosenOption = chosenOption;
    decision.reasoning = reasoning;
    decision.expectedOutcome = expectedOutcome;

    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + reviewInDays);
    decision.reviewDate = reviewDate.toISOString().split('T')[0];

    // AI assessment of the decision
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Assess this decision and provide feedback.

Return JSON:
{
  "confidenceAssessment": 0.0-1.0,
  "potentialBlindSpots": ["blind spot 1"],
  "riskFactors": ["risk 1"],
  "mitigationSuggestions": ["suggestion 1"],
  "emotionalFactors": "assessment of emotional influences"
}`,
      },
      {
        role: 'user',
        content: `Decision: ${decision.title}\nContext: ${decision.context}\nChosen: ${chosenOption}\nReasoning: ${reasoning}\nExpected outcome: ${expectedOutcome}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const assessment = JSON.parse(jsonMatch[0]);
        decision.confidenceLevel = assessment.confidenceAssessment || decision.confidenceLevel;
        decision.emotionalState = assessment.emotionalFactors;
      }
    } catch (error) {
      console.error('Decision assessment failed:', error);
    }

    return decision;
  }

  async reviewDecision(
    decisionId: string,
    actualOutcome: string,
    wouldDecideDifferently: boolean
  ): Promise<DecisionReview> {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    decision.actualOutcome = actualOutcome;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Review this decision outcome and extract learnings.

Return JSON:
{
  "outcomeAccuracy": -1.0 to 1.0,
  "whatWorked": ["thing that worked"],
  "whatDidntWork": ["thing that didn't work"],
  "unexpectedConsequences": ["unexpected thing"],
  "keyLearnings": ["learning 1"],
  "alternativeInHindsight": "what might have been better"
}`,
      },
      {
        role: 'user',
        content: `Decision: ${decision.title}\nExpected: ${decision.expectedOutcome}\nActual: ${actualOutcome}\nWould decide differently: ${wouldDecideDifferently}`,
      },
    ];

    let reviewAnalysis = {
      outcomeAccuracy: 0,
      whatWorked: [],
      whatDidntWork: [],
      unexpectedConsequences: [],
      keyLearnings: [],
      alternativeInHindsight: '',
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewAnalysis = { ...reviewAnalysis, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Decision review failed:', error);
    }

    const review: DecisionReview = {
      decisionId,
      reviewDate: new Date().toISOString().split('T')[0],
      outcomeAccuracy: reviewAnalysis.outcomeAccuracy,
      whatWorked: reviewAnalysis.whatWorked,
      whatDidntWork: reviewAnalysis.whatDidntWork,
      unexpectedConsequences: reviewAnalysis.unexpectedConsequences,
      wouldDecideDifferently,
      alternativeInHindsight: reviewAnalysis.alternativeInHindsight,
      keyLearnings: reviewAnalysis.keyLearnings,
    };

    decision.lessonsLearned = reviewAnalysis.keyLearnings;
    this.reviews.push(review);

    return review;
  }

  async getDecisionsDueForReview(): Promise<Decision[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.decisions.filter(
      d => d.reviewDate && d.reviewDate <= today && !d.actualOutcome
    );
  }

  async generateAnalytics(): Promise<DecisionAnalytics> {
    if (this.decisions.length === 0) {
      return {
        totalDecisions: 0,
        byCategory: [],
        byImportance: [],
        accuracyRate: 0,
        commonBiases: [],
        strengthAreas: [],
        improvementAreas: [],
        patterns: [],
      };
    }

    // Count by category
    const categoryCount: Map<string, number> = new Map();
    const importanceCount: Map<string, number> = new Map();

    for (const decision of this.decisions) {
      categoryCount.set(decision.category, (categoryCount.get(decision.category) || 0) + 1);
      importanceCount.set(decision.importance, (importanceCount.get(decision.importance) || 0) + 1);
    }

    // Calculate accuracy from reviews
    const reviewedDecisions = this.reviews.length;
    const accuracySum = this.reviews.reduce((sum, r) => sum + r.outcomeAccuracy, 0);
    const accuracyRate = reviewedDecisions > 0 ? (accuracySum / reviewedDecisions + 1) / 2 : 0;

    // AI analysis for patterns
    const decisionSummary = this.decisions
      .slice(-20)
      .map(d => `[${d.category}] ${d.title}: ${d.chosenOption} (${d.importance})`)
      .join('\n');

    const reviewSummary = this.reviews
      .slice(-10)
      .map(r => `Accuracy: ${r.outcomeAccuracy}, Learnings: ${r.keyLearnings.join(', ')}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze decision-making patterns and provide insights.

Return JSON:
{
  "commonBiases": ["bias 1"],
  "strengthAreas": ["strength 1"],
  "improvementAreas": ["area 1"],
  "patterns": [{"pattern": "pattern description", "recommendation": "suggestion"}]
}`,
      },
      {
        role: 'user',
        content: `Decisions:\n${decisionSummary}\n\nReviews:\n${reviewSummary}`,
      },
    ];

    let analysis = {
      commonBiases: [],
      strengthAreas: [],
      improvementAreas: [],
      patterns: [],
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Analytics generation failed:', error);
    }

    return {
      totalDecisions: this.decisions.length,
      byCategory: Array.from(categoryCount.entries()).map(([category, count]) => ({ category, count })),
      byImportance: Array.from(importanceCount.entries()).map(([importance, count]) => ({ importance, count })),
      accuracyRate,
      commonBiases: analysis.commonBiases,
      strengthAreas: analysis.strengthAreas,
      improvementAreas: analysis.improvementAreas,
      patterns: analysis.patterns.map(p => ({
        pattern: p.pattern,
        frequency: 1,
        outcomes: { positive: 0, negative: 0, neutral: 0 },
        recommendation: p.recommendation,
      })),
    };
  }

  async getPreMortem(decisionId: string): Promise<{
    potentialFailures: string[];
    preventionStrategies: string[];
    warningSignals: string[];
    contingencyPlans: string[];
  }> {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Perform a pre-mortem analysis: Imagine this decision has failed. What went wrong?

Return JSON:
{
  "potentialFailures": ["failure mode 1"],
  "preventionStrategies": ["strategy 1"],
  "warningSignals": ["signal 1"],
  "contingencyPlans": ["plan 1"]
}

Be thorough but realistic.`,
      },
      {
        role: 'user',
        content: `Decision: ${decision.title}\nChosen option: ${decision.chosenOption}\nExpected outcome: ${decision.expectedOutcome}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      potentialFailures: [],
      preventionStrategies: [],
      warningSignals: [],
      contingencyPlans: [],
    };
  }

  async suggestFramework(context: string): Promise<{
    recommendedFramework: string;
    steps: string[];
    questionsToAsk: string[];
    biasesToWatch: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Suggest a decision-making framework for this situation.

Common frameworks: SWOT, Cost-Benefit, Decision Matrix, Pros/Cons, 10-10-10 Rule, First Principles, etc.

Return JSON:
{
  "recommendedFramework": "framework name",
  "steps": ["step 1", "step 2"],
  "questionsToAsk": ["question 1"],
  "biasesToWatch": ["bias 1"]
}`,
      },
      {
        role: 'user',
        content: context,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      recommendedFramework: 'Pros and Cons',
      steps: ['List all pros', 'List all cons', 'Weight importance', 'Decide'],
      questionsToAsk: ['What is the worst case?', 'What is reversible?'],
      biasesToWatch: ['Confirmation bias', 'Sunk cost fallacy'],
    };
  }

  formatDecisionAsMarkdown(decision: Decision): string {
    return `# 🎯 Decision: ${decision.title}

**Date:** ${decision.date}
**Category:** ${decision.category}
**Importance:** ${decision.importance}
**Reversibility:** ${decision.reversibility}
**Timeframe:** ${decision.timeframe}

## Context
${decision.context}

## Options Considered
${decision.options.map(o => `
### ${o.option}
**Pros:**
${o.pros.map(p => `- ✅ ${p}`).join('\n')}

**Cons:**
${o.cons.map(c => `- ❌ ${c}`).join('\n')}

**Probability of success:** ${Math.round((o.probability || 0.5) * 100)}%
`).join('\n')}

## Decision
**Chosen:** ${decision.chosenOption}

**Reasoning:** ${decision.reasoning}

**Expected Outcome:** ${decision.expectedOutcome}

**Confidence Level:** ${Math.round(decision.confidenceLevel * 100)}%

## Review
**Review Date:** ${decision.reviewDate || 'Not set'}
${decision.actualOutcome ? `**Actual Outcome:** ${decision.actualOutcome}` : ''}
${decision.lessonsLearned ? `**Lessons Learned:**\n${decision.lessonsLearned.map(l => `- ${l}`).join('\n')}` : ''}
`;
  }

  getDecisions(): Decision[] {
    return [...this.decisions];
  }

  setDecisions(decisions: Decision[]): void {
    this.decisions = decisions;
  }

  getReviews(): DecisionReview[] {
    return [...this.reviews];
  }

  setReviews(reviews: DecisionReview[]): void {
    this.reviews = reviews;
  }
}
