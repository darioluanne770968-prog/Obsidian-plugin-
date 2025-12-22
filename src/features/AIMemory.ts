import { TFile, Vault } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface UserPreference {
  key: string;
  value: any;
  confidence: number;
  learnedFrom: string[];
  lastUpdated: number;
}

export interface WritingStyle {
  averageSentenceLength: number;
  vocabularyLevel: 'simple' | 'moderate' | 'advanced';
  formalityLevel: number; // 0-1
  preferredStructure: 'lists' | 'paragraphs' | 'mixed';
  commonPhrases: string[];
  avoidedWords: string[];
  signature: string; // unique style fingerprint
}

export interface MemoryItem {
  id: string;
  type: 'fact' | 'preference' | 'context' | 'interaction';
  content: string;
  importance: number; // 0-1
  accessCount: number;
  createdAt: number;
  lastAccessed: number;
  associations: string[]; // related memory IDs
}

export interface UserProfile {
  interests: { topic: string; strength: number }[];
  expertise: { domain: string; level: number }[];
  goals: string[];
  writingStyle: WritingStyle;
  preferences: UserPreference[];
  personality: {
    openness: number;
    conscientiousness: number;
    analyticalVsCreative: number;
  };
}

export class AIMemory {
  private aiService: AIService;
  private vault: Vault;
  private memories: Map<string, MemoryItem> = new Map();
  private userProfile: UserProfile;
  private maxMemories: number = 1000;

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
    this.userProfile = this.createDefaultProfile();
  }

  private createDefaultProfile(): UserProfile {
    return {
      interests: [],
      expertise: [],
      goals: [],
      writingStyle: {
        averageSentenceLength: 15,
        vocabularyLevel: 'moderate',
        formalityLevel: 0.5,
        preferredStructure: 'mixed',
        commonPhrases: [],
        avoidedWords: [],
        signature: '',
      },
      preferences: [],
      personality: {
        openness: 0.5,
        conscientiousness: 0.5,
        analyticalVsCreative: 0.5,
      },
    };
  }

  async learnFromNotes(sampleSize: number = 50): Promise<void> {
    const files = this.vault.getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, sampleSize);

    let allContent = '';
    const topics: Map<string, number> = new Map();

    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      allContent += content + '\n\n';

      // Extract folder as topic indicator
      const folder = file.path.split('/')[0];
      if (folder !== file.basename) {
        topics.set(folder, (topics.get(folder) || 0) + 1);
      }
    }

    // Analyze writing style
    await this.analyzeWritingStyle(allContent);

    // Extract interests
    await this.extractInterests(allContent);

    // Learn preferences from patterns
    await this.learnPreferences(allContent);

    // Update topics
    for (const [topic, count] of topics) {
      const existing = this.userProfile.interests.find(i => i.topic === topic);
      if (existing) {
        existing.strength = Math.min(1, existing.strength + count * 0.1);
      } else {
        this.userProfile.interests.push({ topic, strength: count * 0.1 });
      }
    }
  }

  private async analyzeWritingStyle(content: string): Promise<void> {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);

    this.userProfile.writingStyle.averageSentenceLength =
      sentences.length > 0 ? words.length / sentences.length : 15;

    // AI analysis for deeper style insights
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Analyze this writing sample and extract style characteristics.

Return JSON:
{
  "vocabularyLevel": "simple|moderate|advanced",
  "formalityLevel": 0.0-1.0,
  "preferredStructure": "lists|paragraphs|mixed",
  "commonPhrases": ["phrase1", "phrase2"],
  "avoidedPatterns": ["pattern1"],
  "styleSignature": "one sentence describing unique voice"
}`,
      },
      {
        role: 'user',
        content: content.slice(0, 5000),
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        this.userProfile.writingStyle = {
          ...this.userProfile.writingStyle,
          ...analysis,
          signature: analysis.styleSignature || '',
        };
      }
    } catch (error) {
      console.error('Style analysis failed:', error);
    }
  }

  private async extractInterests(content: string): Promise<void> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Identify the main interests and expertise areas from this writing.

Return JSON:
{
  "interests": [{"topic": "topic name", "strength": 0.0-1.0}],
  "expertise": [{"domain": "domain name", "level": 1-5}],
  "goals": ["inferred goal 1"]
}

Be specific and accurate.`,
      },
      {
        role: 'user',
        content: content.slice(0, 5000),
      },
    ];

    try {
      const response = await this.aiService.chat(messages);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        this.userProfile.interests = extracted.interests || [];
        this.userProfile.expertise = extracted.expertise || [];
        this.userProfile.goals = extracted.goals || [];
      }
    } catch (error) {
      console.error('Interest extraction failed:', error);
    }
  }

  private async learnPreferences(content: string): Promise<void> {
    // Detect patterns like "I always...", "I prefer...", "I don't like..."
    const preferencePatterns = [
      /I (always|prefer|like|love|enjoy|usually)\s+(.+?)[\.\,\n]/gi,
      /I (never|don't like|avoid|hate|dislike)\s+(.+?)[\.\,\n]/gi,
    ];

    const detectedPrefs: UserPreference[] = [];

    for (const pattern of preferencePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        detectedPrefs.push({
          key: match[1],
          value: match[2].slice(0, 100),
          confidence: 0.7,
          learnedFrom: ['text analysis'],
          lastUpdated: Date.now(),
        });
      }
    }

    // Merge with existing preferences
    for (const pref of detectedPrefs) {
      const existing = this.userProfile.preferences.find(
        p => p.value.toLowerCase().includes(pref.value.toLowerCase())
      );
      if (!existing) {
        this.userProfile.preferences.push(pref);
      }
    }
  }

  // Remember specific facts or contexts
  remember(content: string, type: MemoryItem['type'], importance: number = 0.5): string {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const memory: MemoryItem = {
      id,
      type,
      content,
      importance,
      accessCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      associations: [],
    };

    this.memories.set(id, memory);
    this.pruneMemories();

    return id;
  }

  // Recall relevant memories for a context
  recall(context: string, limit: number = 5): MemoryItem[] {
    const contextLower = context.toLowerCase();
    const scored: { memory: MemoryItem; score: number }[] = [];

    for (const memory of this.memories.values()) {
      let score = 0;

      // Content match
      if (memory.content.toLowerCase().includes(contextLower) ||
          contextLower.includes(memory.content.toLowerCase())) {
        score += 0.5;
      }

      // Importance boost
      score += memory.importance * 0.3;

      // Recency boost
      const daysSinceAccess = (Date.now() - memory.lastAccessed) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 0.2 - daysSinceAccess * 0.01);

      // Access frequency boost
      score += Math.min(0.2, memory.accessCount * 0.02);

      if (score > 0.1) {
        scored.push({ memory, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    // Update access counts
    const results = scored.slice(0, limit).map(s => {
      s.memory.accessCount++;
      s.memory.lastAccessed = Date.now();
      return s.memory;
    });

    return results;
  }

  // Associate memories
  associate(memoryId1: string, memoryId2: string): void {
    const mem1 = this.memories.get(memoryId1);
    const mem2 = this.memories.get(memoryId2);

    if (mem1 && mem2) {
      if (!mem1.associations.includes(memoryId2)) {
        mem1.associations.push(memoryId2);
      }
      if (!mem2.associations.includes(memoryId1)) {
        mem2.associations.push(memoryId1);
      }
    }
  }

  // Generate context-aware system prompt
  generatePersonalizedSystemPrompt(basePrompt: string): string {
    const style = this.userProfile.writingStyle;
    const interests = this.userProfile.interests.slice(0, 5);
    const expertise = this.userProfile.expertise.slice(0, 3);

    let personalizedPrompt = basePrompt;

    personalizedPrompt += `\n\nUser Profile:`;
    personalizedPrompt += `\n- Writing style: ${style.signature || 'Not yet analyzed'}`;
    personalizedPrompt += `\n- Vocabulary level: ${style.vocabularyLevel}`;
    personalizedPrompt += `\n- Formality: ${style.formalityLevel > 0.6 ? 'Formal' : style.formalityLevel < 0.4 ? 'Casual' : 'Neutral'}`;

    if (interests.length > 0) {
      personalizedPrompt += `\n- Main interests: ${interests.map(i => i.topic).join(', ')}`;
    }

    if (expertise.length > 0) {
      personalizedPrompt += `\n- Expertise areas: ${expertise.map(e => e.domain).join(', ')}`;
    }

    personalizedPrompt += `\n\nAdapt your responses to match this user's style and knowledge level.`;

    return personalizedPrompt;
  }

  // Get adaptive response based on user profile
  async getAdaptiveResponse(query: string, baseSystemPrompt: string): Promise<string> {
    // Recall relevant memories
    const memories = this.recall(query, 3);
    const memoryContext = memories.length > 0
      ? `\n\nRelevant context from previous interactions:\n${memories.map(m => `- ${m.content}`).join('\n')}`
      : '';

    const personalizedPrompt = this.generatePersonalizedSystemPrompt(baseSystemPrompt);

    const messages: ChatMessage[] = [
      { role: 'system', content: personalizedPrompt + memoryContext },
      { role: 'user', content: query },
    ];

    const response = await this.aiService.chat(messages);
    return response.content;
  }

  private pruneMemories(): void {
    if (this.memories.size <= this.maxMemories) return;

    // Score all memories
    const scored: { id: string; score: number }[] = [];

    for (const [id, memory] of this.memories) {
      const daysSinceAccess = (Date.now() - memory.lastAccessed) / (1000 * 60 * 60 * 24);
      const score = memory.importance + memory.accessCount * 0.1 - daysSinceAccess * 0.05;
      scored.push({ id, score });
    }

    // Sort and remove lowest scoring
    scored.sort((a, b) => a.score - b.score);
    const toRemove = scored.slice(0, this.memories.size - this.maxMemories);

    for (const { id } of toRemove) {
      this.memories.delete(id);
    }
  }

  // Suggest what user might want to write about
  async suggestNextTopic(): Promise<string[]> {
    const interests = this.userProfile.interests.slice(0, 10);
    const recentMemories = Array.from(this.memories.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, 5);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Based on user interests and recent activity, suggest 3-5 topics they might want to write about next.

Return topics one per line, be specific and relevant.`,
      },
      {
        role: 'user',
        content: `Interests: ${JSON.stringify(interests)}\n\nRecent activity: ${recentMemories.map(m => m.content).join('; ')}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    return response.content
      .split('\n')
      .map(t => t.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(t => t.length > 0);
  }

  getUserProfile(): UserProfile {
    return { ...this.userProfile };
  }

  setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
  }

  getMemories(): MemoryItem[] {
    return Array.from(this.memories.values());
  }

  setMemories(memories: MemoryItem[]): void {
    this.memories.clear();
    for (const memory of memories) {
      this.memories.set(memory.id, memory);
    }
  }

  // Export user profile and memories for backup
  exportData(): { profile: UserProfile; memories: MemoryItem[] } {
    return {
      profile: this.userProfile,
      memories: Array.from(this.memories.values()),
    };
  }

  // Import user profile and memories
  importData(data: { profile: UserProfile; memories: MemoryItem[] }): void {
    this.userProfile = data.profile;
    this.memories.clear();
    for (const memory of data.memories) {
      this.memories.set(memory.id, memory);
    }
  }
}
