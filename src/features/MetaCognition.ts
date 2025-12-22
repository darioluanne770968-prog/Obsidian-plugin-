import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface BiasDetection {
  biasType: string;
  description: string;
  evidence: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface ArgumentAnalysis {
  mainClaim: string;
  premises: { premise: string; strength: number; evidence?: string }[];
  logicalStructure: string;
  fallacies: { type: string; location: string; explanation: string }[];
  overallStrength: number;
  improvements: string[];
}

export interface ThinkingPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  isProductive: boolean;
  suggestion?: string;
}

export interface AssumptionAnalysis {
  assumption: string;
  type: 'explicit' | 'implicit' | 'hidden';
  validity: 'valid' | 'questionable' | 'invalid';
  impact: string;
  alternative: string;
}

export interface DecisionQuality {
  decision: string;
  clarity: number;
  completeness: number;
  biasRisk: number;
  reversibility: number;
  overallScore: number;
  recommendations: string[];
}

export class MetaCognition {
  private aiService: AIService;
  private vault: Vault;

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  // Detect cognitive biases in writing
  async detectBiases(content: string): Promise<BiasDetection[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this text for cognitive biases.

Common biases to look for:
- Confirmation bias: Only seeking supporting evidence
- Availability heuristic: Overweighting recent/memorable examples
- Anchoring: Over-relying on first piece of information
- Survivorship bias: Focusing on successes, ignoring failures
- Dunning-Kruger: Overconfidence in limited knowledge
- Sunk cost fallacy: Continuing due to past investment
- Hindsight bias: "I knew it all along"
- Groupthink: Conforming to group opinion
- Attribution error: Attributing others' actions to character, own to circumstance

Return JSON:
{
  "biases": [
    {
      "biasType": "bias name",
      "description": "what the bias is",
      "evidence": "quote or reference from text",
      "severity": "low|medium|high",
      "suggestion": "how to address it"
    }
  ]
}

Only report biases you're confident about.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.biases || [];
    }

    return [];
  }

  // Analyze argument strength
  async analyzeArgument(content: string): Promise<ArgumentAnalysis> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze the argument structure and strength.

Return JSON:
{
  "mainClaim": "the central claim or thesis",
  "premises": [
    {"premise": "supporting point", "strength": 0.0-1.0, "evidence": "evidence if provided"}
  ],
  "logicalStructure": "how the argument is structured (deductive/inductive/abductive)",
  "fallacies": [
    {"type": "fallacy type", "location": "where in text", "explanation": "why it's a fallacy"}
  ],
  "overallStrength": 0.0-1.0,
  "improvements": ["suggestion 1", "suggestion 2"]
}

Common fallacies: ad hominem, straw man, false dichotomy, slippery slope, appeal to authority, circular reasoning, hasty generalization, red herring.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      mainClaim: '',
      premises: [],
      logicalStructure: 'unknown',
      fallacies: [],
      overallStrength: 0,
      improvements: [],
    };
  }

  // Extract and examine assumptions
  async examineAssumptions(content: string): Promise<AssumptionAnalysis[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Identify assumptions in this text - both explicit and hidden.

Return JSON:
{
  "assumptions": [
    {
      "assumption": "the assumption",
      "type": "explicit|implicit|hidden",
      "validity": "valid|questionable|invalid",
      "impact": "how this assumption affects the argument",
      "alternative": "what if we assume the opposite"
    }
  ]
}

Look for:
- Unstated premises
- Taken-for-granted beliefs
- Cultural assumptions
- Logical leaps`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.assumptions || [];
    }

    return [];
  }

  // Analyze thinking patterns across notes
  async analyzeThinkingPatterns(sampleSize: number = 20): Promise<ThinkingPattern[]> {
    const files = this.vault.getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, sampleSize);

    let allContent = '';
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      allContent += `[${file.basename}]\n${content.slice(0, 500)}\n\n`;
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze thinking patterns across these notes.

Return JSON:
{
  "patterns": [
    {
      "pattern": "description of thinking pattern",
      "frequency": 0.0-1.0,
      "examples": ["example from text"],
      "isProductive": true/false,
      "suggestion": "how to leverage or improve"
    }
  ]
}

Look for:
- Recurring themes or approaches
- Problem-solving styles
- Decision-making patterns
- Learning approaches
- Communication styles`,
      },
      {
        role: 'user',
        content: allContent.slice(0, 8000),
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.patterns || [];
    }

    return [];
  }

  // Evaluate decision quality
  async evaluateDecision(decision: string, context?: string): Promise<DecisionQuality> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Evaluate the quality of this decision/decision-making process.

Return JSON:
{
  "decision": "restatement of decision",
  "clarity": 0.0-1.0,
  "completeness": 0.0-1.0,
  "biasRisk": 0.0-1.0,
  "reversibility": 0.0-1.0,
  "overallScore": 0.0-1.0,
  "recommendations": ["recommendation 1"]
}

Consider:
- Is the decision clearly stated?
- Have alternatives been considered?
- Is there evidence of bias?
- Can this be reversed if wrong?
- What's missing from the analysis?`,
      },
      {
        role: 'user',
        content: context ? `Decision: ${decision}\n\nContext: ${context}` : `Decision: ${decision}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      decision,
      clarity: 0,
      completeness: 0,
      biasRisk: 0,
      reversibility: 0,
      overallScore: 0,
      recommendations: [],
    };
  }

  // Steelman an argument (present the strongest version)
  async steelmanArgument(argument: string): Promise<{
    original: string;
    steelmanned: string;
    improvements: string[];
    counterarguments: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Steelman this argument - present the strongest possible version.

Return JSON:
{
  "steelmanned": "the strongest version of this argument",
  "improvements": ["what was strengthened"],
  "counterarguments": ["strongest counterarguments to consider"]
}

A steelman:
- Interprets charitably
- Adds missing evidence
- Clarifies logic
- Removes weak points
- Addresses obvious objections`,
      },
      {
        role: 'user',
        content: argument,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        original: argument,
        steelmanned: result.steelmanned || '',
        improvements: result.improvements || [],
        counterarguments: result.counterarguments || [],
      };
    }

    return {
      original: argument,
      steelmanned: '',
      improvements: [],
      counterarguments: [],
    };
  }

  // Pre-mortem analysis
  async premortem(plan: string): Promise<{
    plan: string;
    potentialFailures: {
      failure: string;
      likelihood: number;
      impact: number;
      prevention: string;
    }[];
    blindSpots: string[];
    contingencies: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Conduct a pre-mortem: Imagine this plan has failed spectacularly. Why?

Return JSON:
{
  "potentialFailures": [
    {
      "failure": "how it could fail",
      "likelihood": 0.0-1.0,
      "impact": 0.0-1.0,
      "prevention": "how to prevent this"
    }
  ],
  "blindSpots": ["what might we be missing"],
  "contingencies": ["backup plans to have ready"]
}

Think about:
- External factors
- Internal weaknesses
- Timing issues
- Resource constraints
- Human factors
- Unknown unknowns`,
      },
      {
        role: 'user',
        content: `Plan: ${plan}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        plan,
        potentialFailures: result.potentialFailures || [],
        blindSpots: result.blindSpots || [],
        contingencies: result.contingencies || [],
      };
    }

    return {
      plan,
      potentialFailures: [],
      blindSpots: [],
      contingencies: [],
    };
  }

  // Clarity check - how clear is the thinking?
  async checkClarity(content: string): Promise<{
    overallClarity: number;
    issues: {
      type: 'vague' | 'jargon' | 'ambiguous' | 'complex' | 'contradictory';
      location: string;
      suggestion: string;
    }[];
    rewrite: string;
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Evaluate the clarity of this text.

Return JSON:
{
  "overallClarity": 0.0-1.0,
  "issues": [
    {
      "type": "vague|jargon|ambiguous|complex|contradictory",
      "location": "quote or description",
      "suggestion": "how to fix"
    }
  ],
  "rewrite": "clearer version of the key points"
}

Check for:
- Vague language
- Unnecessary jargon
- Ambiguous statements
- Over-complexity
- Internal contradictions`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      overallClarity: 0.5,
      issues: [],
      rewrite: '',
    };
  }

  // Generate thinking prompts based on content
  async generateThinkingPrompts(content: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate thought-provoking questions that would deepen understanding of this content.

Return 5-7 questions, one per line. Questions should:
- Challenge assumptions
- Explore implications
- Connect to other ideas
- Consider alternatives
- Push for specificity`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .map(q => q.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(q => q.length > 10 && q.includes('?'));
  }
}
