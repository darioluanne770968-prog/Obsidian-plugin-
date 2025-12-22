import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface MeetingPrep {
  meetingTitle: string;
  attendees: string[];
  relevantNotes: { path: string; summary: string }[];
  talkingPoints: string[];
  questions: string[];
  backgroundInfo: string;
  suggestedAgenda: string[];
}

export interface MeetingNotes {
  title: string;
  date: string;
  attendees: string[];
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: { task: string; owner?: string; deadline?: string }[];
  followUps: string[];
  openQuestions: string[];
}

export interface MeetingSeries {
  name: string;
  meetings: MeetingNotes[];
  trends: string[];
  recurringTopics: string[];
  progressTracking: { item: string; status: string }[];
}

export class MeetingAssistant {
  private aiService: AIService;
  private vault: Vault;

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  async prepareMeeting(
    title: string,
    attendees: string[],
    context?: string
  ): Promise<MeetingPrep> {
    // Search for relevant notes about attendees and topics
    const relevantNotes: { path: string; summary: string }[] = [];

    const files = this.vault.getMarkdownFiles();
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      const contentLower = content.toLowerCase();
      const titleLower = title.toLowerCase();

      // Check if file mentions the meeting topic or attendees
      const isRelevant = titleLower.split(' ').some(word =>
        word.length > 3 && contentLower.includes(word)
      ) || attendees.some(a => contentLower.includes(a.toLowerCase()));

      if (isRelevant) {
        relevantNotes.push({
          path: file.path,
          summary: content.slice(0, 200) + '...',
        });
      }

      if (relevantNotes.length >= 5) break;
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Prepare for a meeting by generating useful materials.

Return JSON:
{
  "talkingPoints": ["point 1", "point 2"],
  "questions": ["question to ask"],
  "backgroundInfo": "relevant background",
  "suggestedAgenda": ["agenda item 1", "agenda item 2"]
}

Be specific and actionable.`,
      },
      {
        role: 'user',
        content: `Meeting: ${title}\nAttendees: ${attendees.join(', ')}\n${context ? `Context: ${context}` : ''}\n\nRelevant notes:\n${relevantNotes.map(n => n.summary).join('\n')}`,
      },
    ];

    let aiPrep = {
      talkingPoints: [],
      questions: [],
      backgroundInfo: '',
      suggestedAgenda: [],
    };

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiPrep = { ...aiPrep, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (error) {
      console.error('Meeting prep failed:', error);
    }

    return {
      meetingTitle: title,
      attendees,
      relevantNotes,
      ...aiPrep,
    };
  }

  async processRawNotes(rawNotes: string, title?: string): Promise<MeetingNotes> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Process raw meeting notes into a structured format.

Return JSON:
{
  "title": "meeting title",
  "attendees": ["person1", "person2"],
  "summary": "brief summary",
  "keyPoints": ["key point 1"],
  "decisions": ["decision made"],
  "actionItems": [{"task": "task description", "owner": "person", "deadline": "date if mentioned"}],
  "followUps": ["follow up needed"],
  "openQuestions": ["unresolved question"]
}

Extract all actionable information.`,
      },
      {
        role: 'user',
        content: rawNotes,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let processed: MeetingNotes = {
      title: title || 'Meeting Notes',
      date: new Date().toISOString().split('T')[0],
      attendees: [],
      summary: '',
      keyPoints: [],
      decisions: [],
      actionItems: [],
      followUps: [],
      openQuestions: [],
    };

    if (jsonMatch) {
      processed = { ...processed, ...JSON.parse(jsonMatch[0]) };
    }

    return processed;
  }

  async generateFollowUpEmail(meeting: MeetingNotes): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a professional follow-up email based on meeting notes.

Include:
- Brief summary
- Key decisions
- Action items with owners
- Next steps

Keep it concise and actionable.`,
      },
      {
        role: 'user',
        content: JSON.stringify(meeting),
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  async trackActionItems(meetings: MeetingNotes[]): Promise<{
    pending: { task: string; owner?: string; fromMeeting: string; daysOld: number }[];
    completed: { task: string; completedIn: string }[];
    overdue: { task: string; owner?: string; deadline: string }[];
  }> {
    const pending: any[] = [];
    const completed: any[] = [];
    const overdue: any[] = [];
    const now = Date.now();

    for (const meeting of meetings) {
      for (const item of meeting.actionItems) {
        const meetingDate = new Date(meeting.date).getTime();
        const daysOld = Math.floor((now - meetingDate) / (1000 * 60 * 60 * 24));

        if (item.deadline) {
          const deadline = new Date(item.deadline).getTime();
          if (deadline < now) {
            overdue.push({
              task: item.task,
              owner: item.owner,
              deadline: item.deadline,
            });
            continue;
          }
        }

        pending.push({
          task: item.task,
          owner: item.owner,
          fromMeeting: meeting.title,
          daysOld,
        });
      }
    }

    return { pending, completed, overdue };
  }

  async analyzeMeetingSeries(meetings: MeetingNotes[]): Promise<MeetingSeries> {
    if (meetings.length === 0) {
      return {
        name: 'No meetings',
        meetings: [],
        trends: [],
        recurringTopics: [],
        progressTracking: [],
      };
    }

    const allTopics: Map<string, number> = new Map();
    const allDecisions = meetings.flatMap(m => m.decisions);

    for (const meeting of meetings) {
      for (const point of meeting.keyPoints) {
        const words = point.toLowerCase().split(' ').filter(w => w.length > 4);
        for (const word of words) {
          allTopics.set(word, (allTopics.get(word) || 0) + 1);
        }
      }
    }

    const recurringTopics = Array.from(allTopics.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this series of meetings and identify trends.

Return JSON:
{
  "trends": ["trend 1", "trend 2"],
  "progressTracking": [{"item": "tracked item", "status": "status"}]
}`,
      },
      {
        role: 'user',
        content: `Meetings:\n${meetings.map(m => `[${m.date}] ${m.title}: ${m.summary}`).join('\n')}`,
      },
    ];

    let analysis = { trends: [], progressTracking: [] };
    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Meeting series analysis failed:', error);
    }

    return {
      name: meetings[0]?.title || 'Meeting Series',
      meetings,
      trends: analysis.trends,
      recurringTopics,
      progressTracking: analysis.progressTracking,
    };
  }

  async suggestNextMeetingAgenda(previousMeetings: MeetingNotes[]): Promise<string[]> {
    const recentMeetings = previousMeetings.slice(-3);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Based on previous meetings, suggest agenda items for the next meeting.

Return a JSON array of agenda items:
["agenda item 1", "agenda item 2", ...]

Consider:
- Open action items
- Unresolved questions
- Follow-ups needed
- Natural progression of topics`,
      },
      {
        role: 'user',
        content: `Previous meetings:\n${recentMeetings.map(m =>
          `[${m.date}] ${m.title}\nOpen questions: ${m.openQuestions.join(', ')}\nFollow-ups: ${m.followUps.join(', ')}`
        ).join('\n\n')}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return ['Review action items from last meeting', 'Open discussion'];
  }

  formatMeetingNotesAsMarkdown(notes: MeetingNotes): string {
    return `# ${notes.title}

**Date:** ${notes.date}
**Attendees:** ${notes.attendees.join(', ')}

## Summary
${notes.summary}

## Key Points
${notes.keyPoints.map(p => `- ${p}`).join('\n')}

## Decisions
${notes.decisions.map(d => `- ✅ ${d}`).join('\n')}

## Action Items
${notes.actionItems.map(a =>
  `- [ ] ${a.task}${a.owner ? ` (@${a.owner})` : ''}${a.deadline ? ` - Due: ${a.deadline}` : ''}`
).join('\n')}

## Follow-ups
${notes.followUps.map(f => `- ${f}`).join('\n')}

## Open Questions
${notes.openQuestions.map(q => `- ❓ ${q}`).join('\n')}`;
  }

  formatPrepAsMarkdown(prep: MeetingPrep): string {
    return `# 📋 Meeting Prep: ${prep.meetingTitle}

**Attendees:** ${prep.attendees.join(', ')}

## 🎯 Suggested Agenda
${prep.suggestedAgenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## 💬 Talking Points
${prep.talkingPoints.map(p => `- ${p}`).join('\n')}

## ❓ Questions to Ask
${prep.questions.map(q => `- ${q}`).join('\n')}

## 📚 Background Info
${prep.backgroundInfo}

## 📎 Relevant Notes
${prep.relevantNotes.map(n => `- [[${n.path.replace('.md', '')}]]`).join('\n')}`;
  }
}
