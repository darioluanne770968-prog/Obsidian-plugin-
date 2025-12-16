import { AIService, ChatMessage } from '../services/AIService';

export interface AITemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  variables: string[]; // placeholders like {{topic}}, {{date}}
  category: 'writing' | 'productivity' | 'research' | 'creative' | 'custom';
}

export const DEFAULT_TEMPLATES: AITemplate[] = [
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Generate a weekly review template with prompts',
    prompt: `Create a weekly review for the week of {{date}}. Include sections for:
1. Accomplishments - What did I achieve?
2. Challenges - What obstacles did I face?
3. Lessons Learned - What did I learn?
4. Next Week Goals - What do I want to accomplish?
5. Gratitude - What am I thankful for?

Format in markdown with headers and bullet points.`,
    variables: ['date'],
    category: 'productivity',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Structure meeting notes from raw text',
    prompt: `Convert these raw meeting notes into a structured format:

{{content}}

Create a well-organized document with:
- Meeting Title and Date
- Attendees (if mentioned)
- Key Discussion Points
- Decisions Made
- Action Items (with owners if mentioned)
- Next Steps

Format in markdown.`,
    variables: ['content'],
    category: 'productivity',
  },
  {
    id: 'blog-post',
    name: 'Blog Post',
    description: 'Generate a blog post outline on a topic',
    prompt: `Create a detailed blog post outline about: {{topic}}

Include:
- Catchy title options (3 alternatives)
- Introduction hook
- Main sections with subpoints
- Key takeaways
- Call to action
- SEO keywords to consider

Target audience: {{audience}}
Tone: {{tone}}`,
    variables: ['topic', 'audience', 'tone'],
    category: 'writing',
  },
  {
    id: 'research-notes',
    name: 'Research Notes',
    description: 'Structure research notes from a source',
    prompt: `Organize these research notes about {{topic}}:

{{content}}

Structure into:
- Source Information
- Key Findings
- Methodology (if applicable)
- Important Quotes
- Questions/Gaps
- Connections to Other Topics
- Personal Insights

Format in markdown with proper citations.`,
    variables: ['topic', 'content'],
    category: 'research',
  },
  {
    id: 'book-notes',
    name: 'Book Notes',
    description: 'Create structured book notes',
    prompt: `Create comprehensive book notes for "{{title}}" by {{author}}.

Based on the following highlights/notes:
{{content}}

Structure:
- Book Overview (1 paragraph)
- Key Themes
- Chapter-by-Chapter Summary (if content allows)
- Favorite Quotes
- Main Takeaways (top 5)
- How This Applies to My Life
- Related Books/Topics
- Rating and Final Thoughts`,
    variables: ['title', 'author', 'content'],
    category: 'research',
  },
  {
    id: 'project-plan',
    name: 'Project Plan',
    description: 'Create a project plan from a description',
    prompt: `Create a detailed project plan for: {{project}}

Include:
- Project Overview
- Goals and Success Criteria
- Scope (In/Out)
- Key Milestones
- Tasks Breakdown
- Dependencies
- Risks and Mitigations
- Resources Needed

Format as actionable markdown with checkboxes for tasks.`,
    variables: ['project'],
    category: 'productivity',
  },
  {
    id: 'learning-plan',
    name: 'Learning Plan',
    description: 'Create a learning plan for a new skill',
    prompt: `Create a comprehensive learning plan for: {{skill}}

Current level: {{current_level}}
Goal: {{goal}}
Available time: {{time_per_week}}

Include:
- Learning Objectives
- Prerequisites
- Recommended Resources (books, courses, tutorials)
- Practice Projects
- Milestones and Checkpoints
- Tips for Staying Motivated
- How to Measure Progress`,
    variables: ['skill', 'current_level', 'goal', 'time_per_week'],
    category: 'research',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm Ideas',
    description: 'Generate creative ideas on a topic',
    prompt: `Brainstorm creative ideas about: {{topic}}

Generate 10 unique ideas, ranging from:
- Conventional approaches
- Innovative twists
- Wild/moonshot ideas

For each idea, briefly explain:
- The core concept
- Why it might work
- Potential challenges

Think outside the box!`,
    variables: ['topic'],
    category: 'creative',
  },
  {
    id: 'decision-matrix',
    name: 'Decision Matrix',
    description: 'Help analyze a decision with multiple options',
    prompt: `Help me make a decision about: {{decision}}

Options to consider: {{options}}

Create a decision matrix with:
- Key criteria for evaluation
- Pros and cons for each option
- Score each option (1-5) on each criterion
- Overall recommendation with reasoning

Be objective and thorough.`,
    variables: ['decision', 'options'],
    category: 'productivity',
  },
  {
    id: 'story-outline',
    name: 'Story Outline',
    description: 'Create a story outline',
    prompt: `Create a story outline for: {{premise}}

Genre: {{genre}}

Include:
- Title suggestions
- Main characters with brief descriptions
- Setting
- Three-act structure:
  - Act 1: Setup
  - Act 2: Confrontation
  - Act 3: Resolution
- Key plot points
- Themes to explore
- Potential twists`,
    variables: ['premise', 'genre'],
    category: 'creative',
  },
];

export class AITemplates {
  private aiService: AIService;
  private customTemplates: AITemplate[] = [];

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  getAllTemplates(): AITemplate[] {
    return [...DEFAULT_TEMPLATES, ...this.customTemplates];
  }

  getTemplatesByCategory(category: AITemplate['category']): AITemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  getTemplate(id: string): AITemplate | undefined {
    return this.getAllTemplates().find(t => t.id === id);
  }

  addCustomTemplate(template: Omit<AITemplate, 'id'>): AITemplate {
    const newTemplate: AITemplate = {
      ...template,
      id: `custom-${Date.now()}`,
    };
    this.customTemplates.push(newTemplate);
    return newTemplate;
  }

  removeCustomTemplate(id: string): boolean {
    const index = this.customTemplates.findIndex(t => t.id === id);
    if (index !== -1) {
      this.customTemplates.splice(index, 1);
      return true;
    }
    return false;
  }

  async executeTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Replace variables in prompt
    let prompt = template.prompt;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    // Check for unreplaced variables
    const unreplaced = prompt.match(/{{(\w+)}}/g);
    if (unreplaced) {
      throw new Error(`Missing variables: ${unreplaced.join(', ')}`);
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that creates well-structured content. Follow the user\'s template instructions precisely. Output in markdown format.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async executeCustomPrompt(prompt: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Follow the user\'s instructions and output well-formatted content.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  getCustomTemplates(): AITemplate[] {
    return [...this.customTemplates];
  }

  setCustomTemplates(templates: AITemplate[]): void {
    this.customTemplates = templates;
  }
}
