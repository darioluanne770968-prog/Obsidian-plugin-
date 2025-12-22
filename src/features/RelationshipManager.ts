import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface Person {
  id: string;
  name: string;
  aliases: string[];
  relationship: string; // colleague, friend, family, etc.
  organization?: string;
  role?: string;
  howMet?: string;
  firstContact: string;
  lastContact: string;
  contactFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'rare';
  interests: string[];
  notes: string;
  importantDates: { date: string; description: string }[];
  interactions: Interaction[];
  tags: string[];
  strength: number; // 0-1 relationship strength
  linkedNotes: string[];
}

export interface Interaction {
  id: string;
  date: string;
  type: 'meeting' | 'call' | 'email' | 'message' | 'event' | 'other';
  summary: string;
  topics: string[];
  followUps: string[];
  sentiment: number; // -1 to 1
}

export interface RelationshipInsight {
  personId: string;
  personName: string;
  insight: string;
  actionSuggestion: string;
  priority: 'low' | 'medium' | 'high';
}

export interface NetworkAnalysis {
  totalContacts: number;
  byRelationship: { type: string; count: number }[];
  byOrganization: { org: string; count: number }[];
  strongRelationships: string[];
  needsAttention: string[];
  recentlyContacted: string[];
  notContactedRecently: string[];
  upcomingDates: { person: string; date: string; description: string }[];
}

export class RelationshipManager {
  private aiService: AIService;
  private vault: Vault;
  private people: Map<string, Person> = new Map();

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async extractPeopleFromNotes(): Promise<Person[]> {
    const files = this.vault.getMarkdownFiles();
    const extractedPeople: Map<string, Partial<Person>> = new Map();

    for (const file of files.slice(0, 50)) {
      const content = await this.vault.cachedRead(file);

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `Extract mentions of people from this note.

Return JSON:
{
  "people": [
    {
      "name": "full name",
      "context": "how they're mentioned",
      "relationship": "inferred relationship type",
      "organization": "if mentioned"
    }
  ]
}

Only extract real people, not fictional characters or general references.`,
        },
        {
          role: 'user',
          content: content.slice(0, 3000),
        },
      ];

      try {
        const response = await this.aiService.chat(messages);
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extracted = JSON.parse(jsonMatch[0]);
          for (const person of extracted.people || []) {
            const existing = extractedPeople.get(person.name.toLowerCase());
            if (existing) {
              existing.linkedNotes = existing.linkedNotes || [];
              existing.linkedNotes.push(file.path);
            } else {
              extractedPeople.set(person.name.toLowerCase(), {
                name: person.name,
                relationship: person.relationship,
                organization: person.organization,
                linkedNotes: [file.path],
              });
            }
          }
        }
      } catch (error) {
        console.error('People extraction failed for:', file.path, error);
      }
    }

    // Convert to full Person objects
    const newPeople: Person[] = [];
    for (const [_, data] of extractedPeople) {
      if (data.name && !this.people.has(data.name.toLowerCase())) {
        const person = this.createPerson(
          data.name,
          data.relationship || 'unknown',
          data.linkedNotes || []
        );
        person.organization = data.organization;
        newPeople.push(person);
      }
    }

    return newPeople;
  }

  createPerson(name: string, relationship: string, linkedNotes: string[] = []): Person {
    const id = `person_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const today = new Date().toISOString().split('T')[0];

    const person: Person = {
      id,
      name,
      aliases: [],
      relationship,
      firstContact: today,
      lastContact: today,
      contactFrequency: 'monthly',
      interests: [],
      notes: '',
      importantDates: [],
      interactions: [],
      tags: [],
      strength: 0.5,
      linkedNotes,
    };

    this.people.set(name.toLowerCase(), person);
    return person;
  }

  async addInteraction(
    personName: string,
    type: Interaction['type'],
    summary: string
  ): Promise<Interaction> {
    const person = this.people.get(personName.toLowerCase());
    if (!person) {
      throw new Error('Person not found');
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this interaction summary.

Return JSON:
{
  "topics": ["topic1", "topic2"],
  "followUps": ["follow up needed"],
  "sentiment": -1.0 to 1.0
}`,
      },
      {
        role: 'user',
        content: summary,
      },
    ];

    let analysis = { topics: [], followUps: [], sentiment: 0 };
    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Interaction analysis failed:', error);
    }

    const interaction: Interaction = {
      id: `int_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type,
      summary,
      topics: analysis.topics,
      followUps: analysis.followUps,
      sentiment: analysis.sentiment,
    };

    person.interactions.push(interaction);
    person.lastContact = interaction.date;

    // Update relationship strength based on interaction frequency
    this.updateRelationshipStrength(person);

    return interaction;
  }

  private updateRelationshipStrength(person: Person): void {
    const recentInteractions = person.interactions.filter(i => {
      const daysSince = (Date.now() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    });

    const frequencyScore = Math.min(1, recentInteractions.length / 10);
    const sentimentScore = recentInteractions.length > 0
      ? (recentInteractions.reduce((sum, i) => sum + i.sentiment, 0) / recentInteractions.length + 1) / 2
      : 0.5;

    person.strength = frequencyScore * 0.6 + sentimentScore * 0.4;
  }

  async getRelationshipInsights(): Promise<RelationshipInsight[]> {
    const insights: RelationshipInsight[] = [];
    const today = Date.now();

    for (const person of this.people.values()) {
      const daysSinceContact = (today - new Date(person.lastContact).getTime()) / (1000 * 60 * 60 * 24);

      // Check for people who need attention
      const expectedDays = {
        daily: 3,
        weekly: 14,
        monthly: 45,
        quarterly: 120,
        yearly: 400,
        rare: 730,
      };

      if (daysSinceContact > expectedDays[person.contactFrequency]) {
        insights.push({
          personId: person.id,
          personName: person.name,
          insight: `Haven't been in touch for ${Math.round(daysSinceContact)} days`,
          actionSuggestion: `Reach out to ${person.name}`,
          priority: person.strength > 0.7 ? 'high' : daysSinceContact > 180 ? 'medium' : 'low',
        });
      }

      // Check for upcoming important dates
      for (const date of person.importantDates) {
        const dateObj = new Date(date.date);
        dateObj.setFullYear(new Date().getFullYear());
        const daysUntil = (dateObj.getTime() - today) / (1000 * 60 * 60 * 24);

        if (daysUntil > 0 && daysUntil <= 14) {
          insights.push({
            personId: person.id,
            personName: person.name,
            insight: `${date.description} coming up on ${date.date}`,
            actionSuggestion: `Prepare for ${person.name}'s ${date.description}`,
            priority: daysUntil <= 3 ? 'high' : 'medium',
          });
        }
      }

      // Check for pending follow-ups
      for (const interaction of person.interactions.slice(-5)) {
        for (const followUp of interaction.followUps) {
          const daysSinceInteraction = (today - new Date(interaction.date).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceInteraction > 7 && daysSinceInteraction < 30) {
            insights.push({
              personId: person.id,
              personName: person.name,
              insight: `Pending follow-up from ${interaction.date}`,
              actionSuggestion: followUp,
              priority: daysSinceInteraction > 14 ? 'high' : 'medium',
            });
          }
        }
      }
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async generateNetworkAnalysis(): Promise<NetworkAnalysis> {
    const people = Array.from(this.people.values());
    const today = Date.now();

    // Count by relationship type
    const relationshipCounts: Map<string, number> = new Map();
    const orgCounts: Map<string, number> = new Map();

    for (const person of people) {
      relationshipCounts.set(
        person.relationship,
        (relationshipCounts.get(person.relationship) || 0) + 1
      );
      if (person.organization) {
        orgCounts.set(person.organization, (orgCounts.get(person.organization) || 0) + 1);
      }
    }

    // Categorize contacts
    const strongRelationships = people
      .filter(p => p.strength > 0.7)
      .map(p => p.name);

    const needsAttention = people
      .filter(p => {
        const daysSince = (today - new Date(p.lastContact).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 60 && p.strength > 0.3;
      })
      .map(p => p.name);

    const recentlyContacted = people
      .filter(p => {
        const daysSince = (today - new Date(p.lastContact).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 7;
      })
      .map(p => p.name);

    const notContactedRecently = people
      .filter(p => {
        const daysSince = (today - new Date(p.lastContact).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 90;
      })
      .map(p => p.name);

    // Upcoming important dates
    const upcomingDates: { person: string; date: string; description: string }[] = [];
    for (const person of people) {
      for (const date of person.importantDates) {
        const dateObj = new Date(date.date);
        dateObj.setFullYear(new Date().getFullYear());
        const daysUntil = (dateObj.getTime() - today) / (1000 * 60 * 60 * 24);

        if (daysUntil > 0 && daysUntil <= 30) {
          upcomingDates.push({
            person: person.name,
            date: date.date,
            description: date.description,
          });
        }
      }
    }

    return {
      totalContacts: people.length,
      byRelationship: Array.from(relationshipCounts.entries()).map(([type, count]) => ({ type, count })),
      byOrganization: Array.from(orgCounts.entries()).map(([org, count]) => ({ org, count })),
      strongRelationships,
      needsAttention,
      recentlyContacted,
      notContactedRecently,
      upcomingDates: upcomingDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  }

  async suggestConversationTopics(personName: string): Promise<string[]> {
    const person = this.people.get(personName.toLowerCase());
    if (!person) {
      return ['Get to know them better', 'Ask about their work', 'Discuss common interests'];
    }

    const recentTopics = person.interactions
      .slice(-5)
      .flatMap(i => i.topics);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Suggest conversation topics for reconnecting with this person.

Return JSON array:
["topic 1", "topic 2", "topic 3"]

Consider their interests, recent conversation topics, and things to follow up on.`,
      },
      {
        role: 'user',
        content: `Person: ${person.name}
Relationship: ${person.relationship}
Interests: ${person.interests.join(', ')}
Recent topics: ${recentTopics.join(', ')}
Organization: ${person.organization || 'Unknown'}
Notes: ${person.notes}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Topic suggestion failed:', error);
    }

    return person.interests.length > 0
      ? person.interests.slice(0, 3)
      : ['Catch up on recent events', 'Discuss shared interests', 'Ask how they are doing'];
  }

  async generatePersonSummary(personName: string): Promise<string> {
    const person = this.people.get(personName.toLowerCase());
    if (!person) {
      throw new Error('Person not found');
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Generate a brief, helpful summary of this person and the relationship.',
      },
      {
        role: 'user',
        content: JSON.stringify(person),
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  formatPersonAsMarkdown(person: Person): string {
    return `# 👤 ${person.name}

## Basic Info
- **Relationship:** ${person.relationship}
${person.organization ? `- **Organization:** ${person.organization}` : ''}
${person.role ? `- **Role:** ${person.role}` : ''}
- **First Contact:** ${person.firstContact}
- **Last Contact:** ${person.lastContact}
- **Contact Frequency:** ${person.contactFrequency}
- **Relationship Strength:** ${Math.round(person.strength * 100)}%

## Interests
${person.interests.map(i => `- ${i}`).join('\n') || 'No interests recorded'}

## Important Dates
${person.importantDates.map(d => `- ${d.date}: ${d.description}`).join('\n') || 'No dates recorded'}

## Notes
${person.notes || 'No notes'}

## Recent Interactions
${person.interactions.slice(-5).map(i => `
### ${i.date} (${i.type})
${i.summary}
${i.followUps.length > 0 ? `**Follow-ups:** ${i.followUps.join(', ')}` : ''}
`).join('\n') || 'No interactions recorded'}

## Linked Notes
${person.linkedNotes.map(n => `- [[${n.replace('.md', '')}]]`).join('\n') || 'No linked notes'}
`;
  }

  getPerson(name: string): Person | undefined {
    return this.people.get(name.toLowerCase());
  }

  getAllPeople(): Person[] {
    return Array.from(this.people.values());
  }

  setPeople(people: Person[]): void {
    this.people.clear();
    for (const person of people) {
      this.people.set(person.name.toLowerCase(), person);
    }
  }

  updatePerson(name: string, updates: Partial<Person>): void {
    const person = this.people.get(name.toLowerCase());
    if (person) {
      Object.assign(person, updates);
    }
  }

  deletePerson(name: string): boolean {
    return this.people.delete(name.toLowerCase());
  }
}
