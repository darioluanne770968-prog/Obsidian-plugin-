import { TFile, Vault, MetadataCache } from 'obsidian';
import { AIService, ChatMessage } from '../services/AIService';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'writing' | 'learning' | 'connecting' | 'organizing' | 'streak' | 'special';
  requirement: string;
  progress: number; // 0-100
  unlockedAt?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'challenge';
  objectives: {
    description: string;
    target: number;
    current: number;
    completed: boolean;
  }[];
  reward: {
    xp: number;
    achievement?: string;
  };
  expiresAt?: number;
  completedAt?: number;
}

export interface UserStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalNotes: number;
  totalWords: number;
  totalLinks: number;
  streakDays: number;
  longestStreak: number;
  lastActiveDate: string;
  achievements: string[]; // achievement IDs
  completedQuests: number;
}

export interface LeaderboardEntry {
  rank: number;
  metric: string;
  value: number;
  percentile: number;
}

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  // Writing achievements
  { id: 'first-note', name: 'First Steps', description: 'Create your first note', icon: '📝', category: 'writing', requirement: '1 note', progress: 0, rarity: 'common' },
  { id: 'prolific-10', name: 'Getting Started', description: 'Create 10 notes', icon: '✍️', category: 'writing', requirement: '10 notes', progress: 0, rarity: 'common' },
  { id: 'prolific-50', name: 'Prolific Writer', description: 'Create 50 notes', icon: '📚', category: 'writing', requirement: '50 notes', progress: 0, rarity: 'rare' },
  { id: 'prolific-100', name: 'Knowledge Architect', description: 'Create 100 notes', icon: '🏛️', category: 'writing', requirement: '100 notes', progress: 0, rarity: 'epic' },
  { id: 'prolific-500', name: 'Second Brain Master', description: 'Create 500 notes', icon: '🧠', category: 'writing', requirement: '500 notes', progress: 0, rarity: 'legendary' },
  { id: 'wordsmith-1k', name: 'Wordsmith', description: 'Write 1,000 words', icon: '💬', category: 'writing', requirement: '1000 words', progress: 0, rarity: 'common' },
  { id: 'wordsmith-10k', name: 'Storyteller', description: 'Write 10,000 words', icon: '📖', category: 'writing', requirement: '10000 words', progress: 0, rarity: 'rare' },
  { id: 'wordsmith-100k', name: 'Novelist', description: 'Write 100,000 words', icon: '📕', category: 'writing', requirement: '100000 words', progress: 0, rarity: 'legendary' },

  // Connecting achievements
  { id: 'linker-10', name: 'Web Weaver', description: 'Create 10 links', icon: '🔗', category: 'connecting', requirement: '10 links', progress: 0, rarity: 'common' },
  { id: 'linker-100', name: 'Network Builder', description: 'Create 100 links', icon: '🌐', category: 'connecting', requirement: '100 links', progress: 0, rarity: 'rare' },
  { id: 'linker-500', name: 'Graph Master', description: 'Create 500 links', icon: '🕸️', category: 'connecting', requirement: '500 links', progress: 0, rarity: 'epic' },
  { id: 'hub-creator', name: 'Hub Creator', description: 'Create a note with 20+ outgoing links', icon: '⭐', category: 'connecting', requirement: 'hub note', progress: 0, rarity: 'rare' },

  // Streak achievements
  { id: 'streak-3', name: 'Consistent', description: '3-day writing streak', icon: '🔥', category: 'streak', requirement: '3 days', progress: 0, rarity: 'common' },
  { id: 'streak-7', name: 'On Fire', description: '7-day writing streak', icon: '🔥🔥', category: 'streak', requirement: '7 days', progress: 0, rarity: 'rare' },
  { id: 'streak-30', name: 'Unstoppable', description: '30-day writing streak', icon: '🔥💯', category: 'streak', requirement: '30 days', progress: 0, rarity: 'epic' },
  { id: 'streak-100', name: 'Legendary Writer', description: '100-day writing streak', icon: '👑', category: 'streak', requirement: '100 days', progress: 0, rarity: 'legendary' },

  // Learning achievements
  { id: 'flashcard-creator', name: 'Memory Maker', description: 'Create 50 flashcards', icon: '🎴', category: 'learning', requirement: '50 flashcards', progress: 0, rarity: 'rare' },
  { id: 'quiz-master', name: 'Quiz Master', description: 'Complete 10 quizzes', icon: '🎓', category: 'learning', requirement: '10 quizzes', progress: 0, rarity: 'rare' },

  // Special achievements
  { id: 'night-owl', name: 'Night Owl', description: 'Write between midnight and 4am', icon: '🦉', category: 'special', requirement: 'late night', progress: 0, rarity: 'rare' },
  { id: 'early-bird', name: 'Early Bird', description: 'Write between 5am and 7am', icon: '🐦', category: 'special', requirement: 'early morning', progress: 0, rarity: 'rare' },
  { id: 'marathon', name: 'Writing Marathon', description: 'Write 2000+ words in one session', icon: '🏃', category: 'special', requirement: '2000 words/session', progress: 0, rarity: 'epic' },
  { id: 'explorer', name: 'Knowledge Explorer', description: 'Use AI to explore 10 different topics', icon: '🧭', category: 'special', requirement: '10 topics', progress: 0, rarity: 'rare' },
];

export class Gamification {
  private aiService: AIService;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private userStats: UserStats;
  private achievements: Map<string, Achievement> = new Map();
  private activeQuests: Quest[] = [];

  constructor(aiService: AIService, vault: Vault, metadataCache: MetadataCache) {
    this.aiService = aiService;
    this.vault = vault;
    this.metadataCache = metadataCache;
    this.userStats = this.createDefaultStats();
    this.initializeAchievements();
  }

  private createDefaultStats(): UserStats {
    return {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalNotes: 0,
      totalWords: 0,
      totalLinks: 0,
      streakDays: 0,
      longestStreak: 0,
      lastActiveDate: '',
      achievements: [],
      completedQuests: 0,
    };
  }

  private initializeAchievements(): void {
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      this.achievements.set(achievement.id, { ...achievement });
    }
  }

  async calculateStats(): Promise<UserStats> {
    const files = this.vault.getMarkdownFiles();

    let totalWords = 0;
    let totalLinks = 0;

    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      totalWords += content.split(/\s+/).filter(w => w.length > 0).length;

      const cache = this.metadataCache.getFileCache(file);
      totalLinks += cache?.links?.length || 0;
    }

    this.userStats.totalNotes = files.length;
    this.userStats.totalWords = totalWords;
    this.userStats.totalLinks = totalLinks;

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (this.userStats.lastActiveDate === yesterday) {
      this.userStats.streakDays++;
      this.userStats.longestStreak = Math.max(this.userStats.longestStreak, this.userStats.streakDays);
    } else if (this.userStats.lastActiveDate !== today) {
      this.userStats.streakDays = 1;
    }

    this.userStats.lastActiveDate = today;

    // Calculate level from XP
    this.userStats.level = Math.floor(this.userStats.xp / 100) + 1;
    this.userStats.xpToNextLevel = (this.userStats.level * 100) - this.userStats.xp;

    // Check achievements
    this.checkAchievements();

    return this.userStats;
  }

  private checkAchievements(): string[] {
    const newAchievements: string[] = [];

    // Writing achievements
    const noteAchievements = [
      { id: 'first-note', target: 1 },
      { id: 'prolific-10', target: 10 },
      { id: 'prolific-50', target: 50 },
      { id: 'prolific-100', target: 100 },
      { id: 'prolific-500', target: 500 },
    ];

    for (const { id, target } of noteAchievements) {
      const achievement = this.achievements.get(id);
      if (achievement && !achievement.unlockedAt) {
        achievement.progress = Math.min(100, (this.userStats.totalNotes / target) * 100);
        if (this.userStats.totalNotes >= target) {
          achievement.unlockedAt = Date.now();
          this.userStats.achievements.push(id);
          newAchievements.push(id);
          this.addXP(this.getAchievementXP(achievement.rarity));
        }
      }
    }

    // Word achievements
    const wordAchievements = [
      { id: 'wordsmith-1k', target: 1000 },
      { id: 'wordsmith-10k', target: 10000 },
      { id: 'wordsmith-100k', target: 100000 },
    ];

    for (const { id, target } of wordAchievements) {
      const achievement = this.achievements.get(id);
      if (achievement && !achievement.unlockedAt) {
        achievement.progress = Math.min(100, (this.userStats.totalWords / target) * 100);
        if (this.userStats.totalWords >= target) {
          achievement.unlockedAt = Date.now();
          this.userStats.achievements.push(id);
          newAchievements.push(id);
          this.addXP(this.getAchievementXP(achievement.rarity));
        }
      }
    }

    // Link achievements
    const linkAchievements = [
      { id: 'linker-10', target: 10 },
      { id: 'linker-100', target: 100 },
      { id: 'linker-500', target: 500 },
    ];

    for (const { id, target } of linkAchievements) {
      const achievement = this.achievements.get(id);
      if (achievement && !achievement.unlockedAt) {
        achievement.progress = Math.min(100, (this.userStats.totalLinks / target) * 100);
        if (this.userStats.totalLinks >= target) {
          achievement.unlockedAt = Date.now();
          this.userStats.achievements.push(id);
          newAchievements.push(id);
          this.addXP(this.getAchievementXP(achievement.rarity));
        }
      }
    }

    // Streak achievements
    const streakAchievements = [
      { id: 'streak-3', target: 3 },
      { id: 'streak-7', target: 7 },
      { id: 'streak-30', target: 30 },
      { id: 'streak-100', target: 100 },
    ];

    for (const { id, target } of streakAchievements) {
      const achievement = this.achievements.get(id);
      if (achievement && !achievement.unlockedAt) {
        achievement.progress = Math.min(100, (this.userStats.streakDays / target) * 100);
        if (this.userStats.streakDays >= target) {
          achievement.unlockedAt = Date.now();
          this.userStats.achievements.push(id);
          newAchievements.push(id);
          this.addXP(this.getAchievementXP(achievement.rarity));
        }
      }
    }

    // Time-based achievements
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 4) {
      const nightOwl = this.achievements.get('night-owl');
      if (nightOwl && !nightOwl.unlockedAt) {
        nightOwl.unlockedAt = Date.now();
        nightOwl.progress = 100;
        this.userStats.achievements.push('night-owl');
        newAchievements.push('night-owl');
        this.addXP(this.getAchievementXP(nightOwl.rarity));
      }
    }

    if (hour >= 5 && hour < 7) {
      const earlyBird = this.achievements.get('early-bird');
      if (earlyBird && !earlyBird.unlockedAt) {
        earlyBird.unlockedAt = Date.now();
        earlyBird.progress = 100;
        this.userStats.achievements.push('early-bird');
        newAchievements.push('early-bird');
        this.addXP(this.getAchievementXP(earlyBird.rarity));
      }
    }

    return newAchievements;
  }

  private getAchievementXP(rarity: Achievement['rarity']): number {
    switch (rarity) {
      case 'common': return 10;
      case 'rare': return 25;
      case 'epic': return 50;
      case 'legendary': return 100;
    }
  }

  addXP(amount: number): void {
    this.userStats.xp += amount;
    const newLevel = Math.floor(this.userStats.xp / 100) + 1;

    if (newLevel > this.userStats.level) {
      this.userStats.level = newLevel;
      // Level up!
    }

    this.userStats.xpToNextLevel = (this.userStats.level * 100) - this.userStats.xp;
  }

  async generateDailyQuests(): Promise<Quest[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate 3 daily quests for a note-taking app user.

Return JSON:
{
  "quests": [
    {
      "name": "quest name",
      "description": "what to do",
      "objectives": [{"description": "objective", "target": 1}],
      "xp": 10-30
    }
  ]
}

Quest ideas: write X words, create X notes, add X links, review old notes, organize tags, etc.`,
      },
      {
        role: 'user',
        content: `User stats: ${JSON.stringify({
          level: this.userStats.level,
          totalNotes: this.userStats.totalNotes,
          streakDays: this.userStats.streakDays,
        })}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    const quests: Quest[] = [];
    const tomorrow = Date.now() + 86400000;

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      for (const q of result.quests || []) {
        quests.push({
          id: `daily_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: q.name,
          description: q.description,
          type: 'daily',
          objectives: q.objectives.map((o: any) => ({
            description: o.description,
            target: o.target,
            current: 0,
            completed: false,
          })),
          reward: { xp: q.xp || 20 },
          expiresAt: tomorrow,
        });
      }
    }

    this.activeQuests = this.activeQuests.filter(q => q.type !== 'daily');
    this.activeQuests.push(...quests);

    return quests;
  }

  async generateChallenge(difficulty: 'easy' | 'medium' | 'hard'): Promise<Quest> {
    const xpRewards = { easy: 30, medium: 60, hard: 100 };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a ${difficulty} challenge for knowledge management.

Return JSON:
{
  "name": "challenge name",
  "description": "detailed description",
  "objectives": [{"description": "objective", "target": number}]
}

Make it achievable but meaningful.`,
      },
      {
        role: 'user',
        content: `Difficulty: ${difficulty}`,
      },
    ];

    const response = await this.aiService.chat(messages);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);

    let questData: any = {
      name: `${difficulty} Challenge`,
      description: 'Complete this challenge',
      objectives: [{ description: 'Complete the challenge', target: 1 }],
    };

    if (jsonMatch) {
      questData = { ...questData, ...JSON.parse(jsonMatch[0]) };
    }

    const quest: Quest = {
      id: `challenge_${Date.now()}`,
      name: questData.name,
      description: questData.description,
      type: 'challenge',
      objectives: questData.objectives.map((o: any) => ({
        description: o.description,
        target: o.target,
        current: 0,
        completed: false,
      })),
      reward: { xp: xpRewards[difficulty] },
    };

    this.activeQuests.push(quest);
    return quest;
  }

  completeQuestObjective(questId: string, objectiveIndex: number): boolean {
    const quest = this.activeQuests.find(q => q.id === questId);
    if (!quest || objectiveIndex >= quest.objectives.length) return false;

    const objective = quest.objectives[objectiveIndex];
    objective.current++;

    if (objective.current >= objective.target) {
      objective.completed = true;
    }

    // Check if quest is fully complete
    if (quest.objectives.every(o => o.completed)) {
      quest.completedAt = Date.now();
      this.addXP(quest.reward.xp);
      this.userStats.completedQuests++;
      return true;
    }

    return false;
  }

  getLeaderboardPosition(): LeaderboardEntry[] {
    // Simulated leaderboard positions based on percentiles
    return [
      {
        rank: Math.max(1, Math.floor(100 - (this.userStats.totalNotes / 5))),
        metric: 'Total Notes',
        value: this.userStats.totalNotes,
        percentile: Math.min(99, this.userStats.totalNotes / 5),
      },
      {
        rank: Math.max(1, Math.floor(100 - (this.userStats.totalWords / 500))),
        metric: 'Total Words',
        value: this.userStats.totalWords,
        percentile: Math.min(99, this.userStats.totalWords / 500),
      },
      {
        rank: Math.max(1, Math.floor(100 - (this.userStats.longestStreak / 0.5))),
        metric: 'Longest Streak',
        value: this.userStats.longestStreak,
        percentile: Math.min(99, this.userStats.longestStreak * 2),
      },
    ];
  }

  getAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  getActiveQuests(): Quest[] {
    return this.activeQuests.filter(q => !q.completedAt && (!q.expiresAt || q.expiresAt > Date.now()));
  }

  getUserStats(): UserStats {
    return { ...this.userStats };
  }

  setUserStats(stats: UserStats): void {
    this.userStats = stats;
  }

  setAchievements(achievements: Achievement[]): void {
    this.achievements.clear();
    for (const achievement of achievements) {
      this.achievements.set(achievement.id, achievement);
    }
  }

  setActiveQuests(quests: Quest[]): void {
    this.activeQuests = quests;
  }

  generateStatsCard(): string {
    const stats = this.userStats;
    const achievements = this.getAchievements();
    const unlocked = achievements.filter(a => a.unlockedAt).length;

    return `# 📊 Your Knowledge Stats

## Level ${stats.level}
**XP:** ${stats.xp} | **Next Level:** ${stats.xpToNextLevel} XP needed

## 📈 Statistics
| Metric | Value |
|--------|-------|
| 📝 Total Notes | ${stats.totalNotes} |
| 💬 Total Words | ${stats.totalWords.toLocaleString()} |
| 🔗 Total Links | ${stats.totalLinks} |
| 🔥 Current Streak | ${stats.streakDays} days |
| 🏆 Longest Streak | ${stats.longestStreak} days |
| ✅ Quests Completed | ${stats.completedQuests} |

## 🏅 Achievements
**${unlocked}/${achievements.length}** Unlocked

${achievements
  .filter(a => a.unlockedAt)
  .map(a => `- ${a.icon} **${a.name}** - ${a.description}`)
  .join('\n')}

---
*Keep writing to unlock more achievements!*`;
  }
}
