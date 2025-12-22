import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';
import { RAGSearch } from './RAGSearch';

export interface CreativeIdea {
  idea: string;
  technique: string;
  noveltyScore: number;
  feasibility: number;
  nextSteps: string[];
}

export interface ForcedConnection {
  concept1: string;
  concept2: string;
  connections: {
    type: string;
    explanation: string;
    newIdea: string;
  }[];
  combinedInsight: string;
}

export interface SCAMPERResult {
  original: string;
  variations: {
    technique: 'Substitute' | 'Combine' | 'Adapt' | 'Modify' | 'Put to other uses' | 'Eliminate' | 'Reverse';
    idea: string;
    explanation: string;
  }[];
}

export interface AnalogyResult {
  concept: string;
  analogies: {
    domain: string;
    analogy: string;
    insight: string;
    borrowedSolution?: string;
  }[];
}

export interface RandomInspiration {
  trigger: string;
  source: string;
  ideas: string[];
  prompt: string;
}

export class CreativeEngine {
  private aiService: AIService;
  private ragSearch: RAGSearch;
  private vault: Vault;

  constructor(aiService: AIService, ragSearch: RAGSearch, vault: Vault) {
    this.aiService = aiService;
    this.ragSearch = ragSearch;
    this.vault = vault;
  }

  // SCAMPER creative thinking technique
  async applySCAMPER(concept: string): Promise<SCAMPERResult> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Apply the SCAMPER creative thinking technique to generate new ideas.

SCAMPER stands for:
- Substitute: What can be substituted?
- Combine: What can be combined?
- Adapt: What can be adapted from elsewhere?
- Modify/Magnify/Minify: What can be changed?
- Put to other uses: What else could it be used for?
- Eliminate: What can be removed?
- Reverse/Rearrange: What can be reversed or rearranged?

Return JSON:
{
  "variations": [
    {"technique": "Substitute", "idea": "specific idea", "explanation": "how it works"}
  ]
}

Generate at least one idea for each SCAMPER letter.`,
      },
      {
        role: 'user',
        content: `Apply SCAMPER to: ${concept}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        original: concept,
        variations: result.variations || [],
      };
    }

    return { original: concept, variations: [] };
  }

  // Force connection between two random notes
  async forceConnection(note1Path?: string, note2Path?: string): Promise<ForcedConnection> {
    const files = this.vault.getMarkdownFiles();

    // Pick random notes if not specified
    if (!note1Path) {
      note1Path = files[Math.floor(Math.random() * files.length)].path;
    }
    if (!note2Path) {
      let attempts = 0;
      do {
        note2Path = files[Math.floor(Math.random() * files.length)].path;
        attempts++;
      } while (note2Path === note1Path && attempts < 10);
    }

    const file1 = this.vault.getAbstractFileByPath(note1Path) as TFile;
    const file2 = this.vault.getAbstractFileByPath(note2Path) as TFile;

    if (!file1 || !file2) {
      throw new Error('Files not found');
    }

    const content1 = await this.vault.cachedRead(file1);
    const content2 = await this.vault.cachedRead(file2);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Force unexpected creative connections between two unrelated concepts.

Think laterally and find surprising links. The more unexpected, the better!

Return JSON:
{
  "connections": [
    {"type": "connection type", "explanation": "how they connect", "newIdea": "creative idea from this connection"}
  ],
  "combinedInsight": "what new understanding emerges from combining both"
}

Find at least 3 connections. Be creative!`,
      },
      {
        role: 'user',
        content: `Concept 1 (${file1.basename}):\n${content1.slice(0, 1500)}\n\nConcept 2 (${file2.basename}):\n${content2.slice(0, 1500)}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        concept1: file1.basename,
        concept2: file2.basename,
        connections: result.connections || [],
        combinedInsight: result.combinedInsight || '',
      };
    }

    return {
      concept1: file1.basename,
      concept2: file2.basename,
      connections: [],
      combinedInsight: '',
    };
  }

  // Generate analogies from different domains
  async generateAnalogies(concept: string, domains?: string[]): Promise<AnalogyResult> {
    const defaultDomains = [
      'nature', 'sports', 'cooking', 'music', 'architecture',
      'biology', 'physics', 'history', 'mythology', 'games'
    ];

    const targetDomains = domains || defaultDomains.sort(() => Math.random() - 0.5).slice(0, 5);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate analogies for the concept from different domains.

For each domain, create:
1. A relevant analogy
2. What insight it provides
3. Any solution that could be borrowed

Return JSON:
{
  "analogies": [
    {"domain": "domain name", "analogy": "the concept is like...", "insight": "this shows that...", "borrowedSolution": "we could apply..."}
  ]
}

Use these domains: ${targetDomains.join(', ')}`,
      },
      {
        role: 'user',
        content: `Generate analogies for: ${concept}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        concept,
        analogies: result.analogies || [],
      };
    }

    return { concept, analogies: [] };
  }

  // Six Thinking Hats technique
  async sixThinkingHats(problem: string): Promise<{
    white: string; // Facts
    red: string; // Emotions
    black: string; // Caution
    yellow: string; // Optimism
    green: string; // Creativity
    blue: string; // Process
    synthesis: string;
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Apply Six Thinking Hats to analyze this problem from different perspectives.

Return JSON:
{
  "white": "Facts and information - what do we know?",
  "red": "Emotions and intuition - how do we feel?",
  "black": "Caution and risks - what could go wrong?",
  "yellow": "Optimism and benefits - what are the advantages?",
  "green": "Creativity and alternatives - what new ideas emerge?",
  "blue": "Process and meta - how should we think about this?",
  "synthesis": "Combined insight from all perspectives"
}`,
      },
      {
        role: 'user',
        content: `Problem: ${problem}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      white: '', red: '', black: '', yellow: '', green: '', blue: '',
      synthesis: 'Unable to analyze',
    };
  }

  // Random inspiration from notes
  async getRandomInspiration(): Promise<RandomInspiration> {
    const files = this.vault.getMarkdownFiles();
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const content = await this.vault.cachedRead(randomFile);

    // Extract random sentence or paragraph
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
    const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)] || content.slice(0, 200);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Use this random text as inspiration to generate new ideas.

Return JSON:
{
  "ideas": ["idea 1", "idea 2", "idea 3"],
  "prompt": "A creative prompt inspired by this text"
}

Think laterally! How could this inspire something completely different?`,
      },
      {
        role: 'user',
        content: randomParagraph,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let ideas: string[] = [];
    let prompt = '';

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      ideas = result.ideas || [];
      prompt = result.prompt || '';
    }

    return {
      trigger: randomParagraph.slice(0, 200),
      source: randomFile.path,
      ideas,
      prompt,
    };
  }

  // Reverse brainstorming
  async reverseBrainstorm(goal: string): Promise<{
    antiGoal: string;
    waysToCauseFailure: string[];
    insights: string[];
    preventionStrategies: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Apply reverse brainstorming: Instead of how to achieve the goal, think about how to cause the opposite.

Return JSON:
{
  "antiGoal": "the opposite of the goal",
  "waysToCauseFailure": ["way 1", "way 2", "way 3"],
  "insights": ["what this reveals about success"],
  "preventionStrategies": ["how to prevent each failure mode"]
}`,
      },
      {
        role: 'user',
        content: `Goal: ${goal}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      antiGoal: '',
      waysToCauseFailure: [],
      insights: [],
      preventionStrategies: [],
    };
  }

  // First Principles thinking
  async firstPrinciples(problem: string): Promise<{
    assumptions: string[];
    fundamentalTruths: string[];
    freshPerspective: string;
    newApproaches: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Apply First Principles thinking: Break down to fundamental truths and rebuild.

Return JSON:
{
  "assumptions": ["assumption we normally make"],
  "fundamentalTruths": ["what we know to be absolutely true"],
  "freshPerspective": "new way of seeing this without assumptions",
  "newApproaches": ["approach 1 from first principles"]
}`,
      },
      {
        role: 'user',
        content: `Problem: ${problem}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      assumptions: [],
      fundamentalTruths: [],
      freshPerspective: '',
      newApproaches: [],
    };
  }

  // Oblique Strategies (inspired by Brian Eno)
  async obliqueStrategy(): Promise<{ strategy: string; interpretation: string; application: string }> {
    const strategies = [
      "Honor thy error as a hidden intention",
      "What would your closest friend do?",
      "What wouldn't you do?",
      "Emphasize differences",
      "Emphasize repetitions",
      "Remove specifics and convert to ambiguities",
      "Don't be afraid of things because they're easy to do",
      "Use an old idea",
      "State the problem in words as clearly as possible",
      "Only one element of each kind",
      "What are you really thinking about just now?",
      "Discover the recipes you are using and abandon them",
      "Turn it upside down",
      "Think of the radio",
      "Allow an easement (an easement is the abandonment of a stricture)",
      "Simple subtraction",
      "Go slowly all the way round the outside",
      "Make an exhaustive list of everything you might do and do the last thing on the list",
      "Into the impossible",
      "Ask your body",
    ];

    const strategy = strategies[Math.floor(Math.random() * strategies.length)];

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Interpret this oblique strategy and suggest how to apply it.

Return JSON:
{
  "interpretation": "what this strategy means",
  "application": "specific way to apply it to creative work"
}`,
      },
      {
        role: 'user',
        content: `Strategy: "${strategy}"`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        strategy,
        interpretation: result.interpretation || '',
        application: result.application || '',
      };
    }

    return { strategy, interpretation: '', application: '' };
  }

  // Idea evolution - take an idea through iterations
  async evolveIdea(idea: string, iterations: number = 3): Promise<{
    original: string;
    evolutions: { iteration: number; idea: string; change: string }[];
    finalIdea: string;
  }> {
    const evolutions: { iteration: number; idea: string; change: string }[] = [];
    let currentIdea = idea;

    for (let i = 1; i <= iterations; i++) {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `Evolve this idea to make it better, more interesting, or more novel.

Return JSON:
{
  "evolvedIdea": "the improved idea",
  "whatChanged": "what was improved or changed"
}

Make a meaningful change, not just rewording.`,
        },
        {
          role: 'user',
          content: `Current idea: ${currentIdea}`,
        },
      ];

      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        currentIdea = result.evolvedIdea;
        evolutions.push({
          iteration: i,
          idea: result.evolvedIdea,
          change: result.whatChanged,
        });
      }
    }

    return {
      original: idea,
      evolutions,
      finalIdea: currentIdea,
    };
  }
}
