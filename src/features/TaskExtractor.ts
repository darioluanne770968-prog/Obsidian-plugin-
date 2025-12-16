import { AIService, ChatMessage } from '../services/AIService';

export interface ExtractedTask {
  task: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  assignee?: string;
  context?: string;
  tags?: string[];
}

export interface ActionItem {
  action: string;
  owner?: string;
  deadline?: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export class TaskExtractor {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async extractTasks(content: string): Promise<ExtractedTask[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a task extraction assistant. Analyze the given text and extract any tasks, to-dos, or action items.

For each task, identify:
- The task itself (clear, actionable description)
- Priority (high/medium/low) if inferable
- Due date if mentioned
- Assignee if mentioned
- Relevant context
- Related tags

Return a JSON array:
[{"task": "description", "priority": "medium", "dueDate": "2024-01-15", "assignee": "John", "context": "from meeting", "tags": ["project-x"]}]

If no tasks are found, return an empty array.
Only output valid JSON.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Task extraction failed:', error);
      return [];
    }
  }

  async extractActionItems(meetingNotes: string): Promise<ActionItem[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a meeting notes analyzer. Extract action items from the meeting notes.

For each action item, identify:
- The action (clear, specific description)
- Owner/assignee (if mentioned)
- Deadline (if mentioned)
- Status (assume 'pending' unless stated otherwise)

Return a JSON array:
[{"action": "Complete the report", "owner": "Alice", "deadline": "Friday", "status": "pending"}]

Only output valid JSON.`,
      },
      {
        role: 'user',
        content: meetingNotes,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Action item extraction failed:', error);
      return [];
    }
  }

  async extractDates(content: string): Promise<{ date: string; context: string }[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a date extraction assistant. Find all date references in the text.

For each date, provide:
- The date (in ISO format YYYY-MM-DD if possible, or as mentioned)
- The context (what's happening on that date)

Return a JSON array:
[{"date": "2024-01-15", "context": "project deadline"}]

Include relative dates like "next Monday", "tomorrow", etc.
Only output valid JSON.`,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Date extraction failed:', error);
      return [];
    }
  }

  formatTasksAsMarkdown(tasks: ExtractedTask[]): string {
    if (tasks.length === 0) return 'No tasks found.';

    const lines: string[] = ['## Extracted Tasks\n'];

    // Group by priority
    const highPriority = tasks.filter(t => t.priority === 'high');
    const mediumPriority = tasks.filter(t => t.priority === 'medium');
    const lowPriority = tasks.filter(t => t.priority === 'low');
    const noPriority = tasks.filter(t => !t.priority);

    const formatTask = (task: ExtractedTask): string => {
      let line = `- [ ] ${task.task}`;
      const meta: string[] = [];

      if (task.dueDate) meta.push(`📅 ${task.dueDate}`);
      if (task.assignee) meta.push(`👤 ${task.assignee}`);
      if (task.tags && task.tags.length > 0) {
        meta.push(task.tags.map(t => `#${t}`).join(' '));
      }

      if (meta.length > 0) {
        line += ` (${meta.join(' | ')})`;
      }

      return line;
    };

    if (highPriority.length > 0) {
      lines.push('### 🔴 High Priority');
      highPriority.forEach(t => lines.push(formatTask(t)));
      lines.push('');
    }

    if (mediumPriority.length > 0) {
      lines.push('### 🟡 Medium Priority');
      mediumPriority.forEach(t => lines.push(formatTask(t)));
      lines.push('');
    }

    if (lowPriority.length > 0) {
      lines.push('### 🟢 Low Priority');
      lowPriority.forEach(t => lines.push(formatTask(t)));
      lines.push('');
    }

    if (noPriority.length > 0) {
      lines.push('### Other Tasks');
      noPriority.forEach(t => lines.push(formatTask(t)));
    }

    return lines.join('\n');
  }

  formatActionItemsAsMarkdown(items: ActionItem[]): string {
    if (items.length === 0) return 'No action items found.';

    const lines: string[] = ['## Action Items\n'];

    for (const item of items) {
      const checkbox = item.status === 'completed' ? '[x]' : '[ ]';
      let line = `- ${checkbox} ${item.action}`;

      const meta: string[] = [];
      if (item.owner) meta.push(`@${item.owner}`);
      if (item.deadline) meta.push(`Due: ${item.deadline}`);

      if (meta.length > 0) {
        line += ` *(${meta.join(' | ')})*`;
      }

      lines.push(line);
    }

    return lines.join('\n');
  }

  async generateTasksFromGoal(goal: string): Promise<ExtractedTask[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a task planning assistant. Given a goal, break it down into actionable tasks.

Create 5-10 specific, achievable tasks that will help accomplish the goal.
Order them logically (prerequisites first).

Return a JSON array:
[{"task": "specific action", "priority": "high/medium/low", "tags": ["relevant-tag"]}]

Make tasks specific and actionable.
Only output valid JSON.`,
      },
      {
        role: 'user',
        content: `Goal: ${goal}`,
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Task generation failed:', error);
      return [];
    }
  }
}
