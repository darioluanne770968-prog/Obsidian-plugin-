import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  stage: 'spark' | 'developing' | 'refining' | 'ready' | 'implemented' | 'archived';
  createdAt: string;
  updatedAt: string;
  tags: string[];
  inspirations: string[]; // Sources of inspiration
  relatedIdeas: string[]; // IDs of related ideas
  notes: IdeaNote[];
  experiments: Experiment[];
  feedback: Feedback[];
  maturityScore: number; // 0-1
  potentialScore: number; // 0-1
  effortEstimate: 'low' | 'medium' | 'high';
  impactEstimate: 'low' | 'medium' | 'high';
  blockers: string[];
  nextSteps: string[];
}

export interface IdeaNote {
  id: string;
  date: string;
  content: string;
  type: 'observation' | 'question' | 'breakthrough' | 'concern' | 'reference';
}

export interface Experiment {
  id: string;
  description: string;
  hypothesis: string;
  status: 'planned' | 'in-progress' | 'completed' | 'abandoned';
  result?: string;
  learnings?: string[];
  date: string;
}

export interface Feedback {
  id: string;
  date: string;
  source: string;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  actionable: boolean;
  addressed: boolean;
}

export interface IdeaConnection {
  idea1: string;
  idea2: string;
  connectionType: 'builds-on' | 'contrasts' | 'combines-with' | 'enables' | 'conflicts';
  strength: number;
  insight: string;
}

export interface IdeaCluster {
  theme: string;
  ideas: string[];
  emergentInsight: string;
  potentialProject: string;
}

export class IdeaIncubator {
  private aiService: AIService;
  private vault: Vault;
  private ideas: Map<string, Idea> = new Map();
  private connections: IdeaConnection[] = [];

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async captureIdea(
    title: string,
    description: string,
    category?: string
  ): Promise<Idea> {
    const id = `idea_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const today = new Date().toISOString().split('T')[0];

    // AI analysis of the idea
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this new idea and provide initial assessment.

Return JSON:
{
  "category": "suggested category",
  "tags": ["tag1", "tag2"],
  "potentialScore": 0.0-1.0,
  "effortEstimate": "low|medium|high",
  "impactEstimate": "low|medium|high",
  "initialQuestions": ["question to explore"],
  "suggestedNextSteps": ["next step 1"]
}`,
      },
      {
        role: 'user',
        content: `Title: ${title}\n\nDescription: ${description}`,
      },
    ];

    let analysis = {
      category: category || 'General',
      tags: [],
      potentialScore: 0.5,
      effortEstimate: 'medium' as const,
      impactEstimate: 'medium' as const,
      initialQuestions: [],
      suggestedNextSteps: [],
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Idea analysis failed:', error);
    }

    const idea: Idea = {
      id,
      title,
      description,
      category: category || analysis.category,
      stage: 'spark',
      createdAt: today,
      updatedAt: today,
      tags: analysis.tags,
      inspirations: [],
      relatedIdeas: [],
      notes: analysis.initialQuestions.map((q, i) => ({
        id: `note_${Date.now()}_${i}`,
        date: today,
        content: q,
        type: 'question' as const,
      })),
      experiments: [],
      feedback: [],
      maturityScore: 0.1,
      potentialScore: analysis.potentialScore,
      effortEstimate: analysis.effortEstimate,
      impactEstimate: analysis.impactEstimate,
      blockers: [],
      nextSteps: analysis.suggestedNextSteps,
    };

    this.ideas.set(id, idea);

    // Find connections to existing ideas
    await this.findConnections(id);

    return idea;
  }

  private async findConnections(ideaId: string): Promise<void> {
    const idea = this.ideas.get(ideaId);
    if (!idea || this.ideas.size < 2) return;

    const otherIdeas = Array.from(this.ideas.values())
      .filter(i => i.id !== ideaId)
      .slice(-20);

    if (otherIdeas.length === 0) return;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Find connections between the new idea and existing ideas.

Return JSON:
{
  "connections": [
    {
      "ideaId": "id of related idea",
      "connectionType": "builds-on|contrasts|combines-with|enables|conflicts",
      "strength": 0.0-1.0,
      "insight": "what this connection reveals"
    }
  ]
}

Only include meaningful connections (strength > 0.3).`,
      },
      {
        role: 'user',
        content: `New idea:\nTitle: ${idea.title}\nDescription: ${idea.description}\n\nExisting ideas:\n${otherIdeas.map(i => `[${i.id}] ${i.title}: ${i.description.slice(0, 100)}`).join('\n')}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        for (const conn of result.connections || []) {
          if (this.ideas.has(conn.ideaId)) {
            this.connections.push({
              idea1: ideaId,
              idea2: conn.ideaId,
              connectionType: conn.connectionType,
              strength: conn.strength,
              insight: conn.insight,
            });

            idea.relatedIdeas.push(conn.ideaId);
            const otherIdea = this.ideas.get(conn.ideaId);
            if (otherIdea && !otherIdea.relatedIdeas.includes(ideaId)) {
              otherIdea.relatedIdeas.push(ideaId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Connection finding failed:', error);
    }
  }

  async addNote(ideaId: string, content: string, type: IdeaNote['type']): Promise<IdeaNote> {
    const idea = this.ideas.get(ideaId);
    if (!idea) {
      throw new Error('Idea not found');
    }

    const note: IdeaNote = {
      id: `note_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      content,
      type,
    };

    idea.notes.push(note);
    idea.updatedAt = note.date;

    // Update maturity score
    this.updateMaturityScore(idea);

    return note;
  }

  async addExperiment(ideaId: string, description: string, hypothesis: string): Promise<Experiment> {
    const idea = this.ideas.get(ideaId);
    if (!idea) {
      throw new Error('Idea not found');
    }

    const experiment: Experiment = {
      id: `exp_${Date.now()}`,
      description,
      hypothesis,
      status: 'planned',
      date: new Date().toISOString().split('T')[0],
    };

    idea.experiments.push(experiment);
    idea.updatedAt = experiment.date;

    return experiment;
  }

  async completeExperiment(
    ideaId: string,
    experimentId: string,
    result: string
  ): Promise<Experiment> {
    const idea = this.ideas.get(ideaId);
    if (!idea) {
      throw new Error('Idea not found');
    }

    const experiment = idea.experiments.find(e => e.id === experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    experiment.status = 'completed';
    experiment.result = result;

    // AI to extract learnings
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Extract key learnings from this experiment.

Return JSON:
{
  "learnings": ["learning 1", "learning 2"],
  "impactOnIdea": "how this affects the idea",
  "suggestedNextExperiment": "next experiment to try"
}`,
      },
      {
        role: 'user',
        content: `Hypothesis: ${experiment.hypothesis}\nResult: ${result}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        experiment.learnings = analysis.learnings;
      }
    } catch (error) {
      console.error('Learning extraction failed:', error);
    }

    this.updateMaturityScore(idea);
    return experiment;
  }

  private updateMaturityScore(idea: Idea): void {
    let score = 0.1; // Base score

    // Notes contribute
    score += Math.min(0.2, idea.notes.length * 0.02);

    // Experiments contribute
    const completedExperiments = idea.experiments.filter(e => e.status === 'completed').length;
    score += Math.min(0.3, completedExperiments * 0.1);

    // Feedback contributes
    score += Math.min(0.2, idea.feedback.length * 0.05);

    // Connections contribute
    score += Math.min(0.2, idea.relatedIdeas.length * 0.05);

    idea.maturityScore = Math.min(1, score);

    // Update stage based on maturity
    if (idea.maturityScore >= 0.8) {
      idea.stage = 'ready';
    } else if (idea.maturityScore >= 0.5) {
      idea.stage = 'refining';
    } else if (idea.maturityScore >= 0.2) {
      idea.stage = 'developing';
    }
  }

  async getDevelopmentSuggestions(ideaId: string): Promise<{
    questions: string[];
    experiments: string[];
    resources: string[];
    connections: string[];
  }> {
    const idea = this.ideas.get(ideaId);
    if (!idea) {
      throw new Error('Idea not found');
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Suggest ways to develop and validate this idea.

Return JSON:
{
  "questions": ["question to explore"],
  "experiments": ["experiment to try"],
  "resources": ["resource to look into"],
  "connections": ["connection to explore"]
}

Be specific and actionable.`,
      },
      {
        role: 'user',
        content: `Idea: ${idea.title}
Description: ${idea.description}
Stage: ${idea.stage}
Notes so far: ${idea.notes.map(n => n.content).join('; ')}
Experiments done: ${idea.experiments.filter(e => e.status === 'completed').map(e => e.result).join('; ')}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      questions: ['What problem does this solve?', 'Who would benefit?'],
      experiments: ['Create a simple prototype', 'Get feedback from one person'],
      resources: ['Research similar ideas', 'Find relevant case studies'],
      connections: ['Look for complementary ideas', 'Find potential collaborators'],
    };
  }

  async findClusters(): Promise<IdeaCluster[]> {
    const ideas = Array.from(this.ideas.values());
    if (ideas.length < 3) return [];

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Cluster these ideas into themes and identify emergent insights.

Return JSON:
{
  "clusters": [
    {
      "theme": "theme name",
      "ideaIds": ["id1", "id2"],
      "emergentInsight": "what emerges from combining these",
      "potentialProject": "project that could come from this cluster"
    }
  ]
}`,
      },
      {
        role: 'user',
        content: ideas.map(i => `[${i.id}] ${i.title}: ${i.description.slice(0, 150)}`).join('\n'),
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return (result.clusters || []).map((c: any) => ({
          theme: c.theme,
          ideas: c.ideaIds,
          emergentInsight: c.emergentInsight,
          potentialProject: c.potentialProject,
        }));
      }
    } catch (error) {
      console.error('Clustering failed:', error);
    }

    return [];
  }

  async getRandomPrompt(): Promise<string> {
    const ideas = Array.from(this.ideas.values());
    const randomIdea = ideas[Math.floor(Math.random() * ideas.length)];

    if (!randomIdea) {
      return 'What problem have you noticed recently that could be solved differently?';
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Generate a thought-provoking prompt inspired by this idea that could lead to new ideas.',
      },
      {
        role: 'user',
        content: `Idea: ${randomIdea.title} - ${randomIdea.description}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async combineIdeas(ideaId1: string, ideaId2: string): Promise<Idea | null> {
    const idea1 = this.ideas.get(ideaId1);
    const idea2 = this.ideas.get(ideaId2);

    if (!idea1 || !idea2) return null;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Combine these two ideas into a new, novel idea.

Return JSON:
{
  "title": "new idea title",
  "description": "description of the combined idea",
  "whatItTakesFromEach": ["from idea 1...", "from idea 2..."],
  "uniqueValue": "what makes this combination special"
}`,
      },
      {
        role: 'user',
        content: `Idea 1: ${idea1.title}\n${idea1.description}\n\nIdea 2: ${idea2.title}\n${idea2.description}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const combined = JSON.parse(jsonMatch[0]);
        const newIdea = await this.captureIdea(combined.title, combined.description);
        newIdea.inspirations = [idea1.title, idea2.title];
        return newIdea;
      }
    } catch (error) {
      console.error('Idea combination failed:', error);
    }

    return null;
  }

  getIdeasByStage(stage: Idea['stage']): Idea[] {
    return Array.from(this.ideas.values()).filter(i => i.stage === stage);
  }

  getHighPotentialIdeas(): Idea[] {
    return Array.from(this.ideas.values())
      .filter(i => i.potentialScore > 0.7 && i.stage !== 'archived' && i.stage !== 'implemented')
      .sort((a, b) => b.potentialScore - a.potentialScore);
  }

  formatIdeaAsMarkdown(idea: Idea): string {
    return `# 💡 ${idea.title}

## Overview
- **Stage:** ${idea.stage}
- **Category:** ${idea.category}
- **Created:** ${idea.createdAt}
- **Updated:** ${idea.updatedAt}
- **Maturity:** ${Math.round(idea.maturityScore * 100)}%
- **Potential:** ${Math.round(idea.potentialScore * 100)}%
- **Effort:** ${idea.effortEstimate}
- **Impact:** ${idea.impactEstimate}

## Description
${idea.description}

## Tags
${idea.tags.map(t => `#${t}`).join(' ')}

## Notes
${idea.notes.map(n => `
### [${n.type}] ${n.date}
${n.content}
`).join('\n')}

## Experiments
${idea.experiments.map(e => `
### ${e.description}
- **Status:** ${e.status}
- **Hypothesis:** ${e.hypothesis}
${e.result ? `- **Result:** ${e.result}` : ''}
${e.learnings ? `- **Learnings:** ${e.learnings.join(', ')}` : ''}
`).join('\n') || 'No experiments yet'}

## Next Steps
${idea.nextSteps.map(s => `- [ ] ${s}`).join('\n') || 'No next steps defined'}

## Related Ideas
${idea.relatedIdeas.map(id => {
  const related = this.ideas.get(id);
  return related ? `- [[${related.title}]]` : '';
}).filter(Boolean).join('\n') || 'No related ideas'}

## Inspirations
${idea.inspirations.map(i => `- ${i}`).join('\n') || 'No inspirations recorded'}
`;
  }

  getIdea(id: string): Idea | undefined {
    return this.ideas.get(id);
  }

  getAllIdeas(): Idea[] {
    return Array.from(this.ideas.values());
  }

  setIdeas(ideas: Idea[]): void {
    this.ideas.clear();
    for (const idea of ideas) {
      this.ideas.set(idea.id, idea);
    }
  }

  getConnections(): IdeaConnection[] {
    return [...this.connections];
  }

  setConnections(connections: IdeaConnection[]): void {
    this.connections = connections;
  }

  updateIdea(id: string, updates: Partial<Idea>): void {
    const idea = this.ideas.get(id);
    if (idea) {
      Object.assign(idea, updates);
      idea.updatedAt = new Date().toISOString().split('T')[0];
    }
  }

  archiveIdea(id: string): void {
    const idea = this.ideas.get(id);
    if (idea) {
      idea.stage = 'archived';
      idea.updatedAt = new Date().toISOString().split('T')[0];
    }
  }
}
