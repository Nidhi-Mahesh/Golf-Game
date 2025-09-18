import { LeaderboardEntry } from '@/shared/types';

const LEADERBOARD_KEY = 'golfLeaderboard';

export class LeaderboardService {
  static addScore(playerName: string, level: number, strokes: number): void {
    const entry: LeaderboardEntry = {
      playerName: playerName.trim(),
      level,
      strokes,
      timestamp: Date.now(),
    };

    const existingEntries = this.getAllEntries();
    existingEntries.push(entry);
    
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(existingEntries));
  }

  static getAllEntries(): LeaderboardEntry[] {
    const stored = localStorage.getItem(LEADERBOARD_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  static getTopScoresForLevel(level: number, limit: number = 10): LeaderboardEntry[] {
    const allEntries = this.getAllEntries();
    
    return allEntries
      .filter(entry => entry.level === level)
      .sort((a, b) => {
        // Sort by strokes (ascending - lower is better)
        if (a.strokes !== b.strokes) {
          return a.strokes - b.strokes;
        }
        // If strokes are equal, sort by timestamp (earlier is better)
        return a.timestamp - b.timestamp;
      })
      .slice(0, limit);
  }

  static getPlayerBestForLevel(playerName: string, level: number): LeaderboardEntry | null {
    const allEntries = this.getAllEntries();
    
    const playerEntries = allEntries
      .filter(entry => entry.playerName === playerName && entry.level === level)
      .sort((a, b) => {
        if (a.strokes !== b.strokes) {
          return a.strokes - b.strokes;
        }
        return a.timestamp - b.timestamp;
      });

    return playerEntries[0] || null;
  }

  static getOverallLeaderboard(limit: number = 20): { playerName: string; totalStrokes: number; levelsCompleted: number }[] {
    const allEntries = this.getAllEntries();
    const playerStats = new Map<string, { totalStrokes: number; levels: Set<number> }>();

    // Get best score for each player per level
    allEntries.forEach(entry => {
      const key = `${entry.playerName}-${entry.level}`;
      const existing = playerStats.get(key);
      
      if (!existing || entry.strokes < existing.totalStrokes) {
        const playerData = playerStats.get(entry.playerName) || { totalStrokes: 0, levels: new Set() };
        
        // Remove previous score for this level if exists
        if (existing) {
          playerData.totalStrokes -= existing.totalStrokes;
        }
        
        playerData.totalStrokes += entry.strokes;
        playerData.levels.add(entry.level);
        playerStats.set(entry.playerName, playerData);
        playerStats.set(key, { totalStrokes: entry.strokes, levels: new Set() });
      }
    });

    // Convert to array and sort
    const leaderboard = Array.from(playerStats.entries())
      .filter(([key]) => !key.includes('-')) // Filter out level-specific keys
      .map(([playerName, stats]) => ({
        playerName,
        totalStrokes: stats.totalStrokes,
        levelsCompleted: stats.levels.size,
      }))
      .sort((a, b) => {
        // Sort by levels completed (descending), then by total strokes (ascending)
        if (a.levelsCompleted !== b.levelsCompleted) {
          return b.levelsCompleted - a.levelsCompleted;
        }
        return a.totalStrokes - b.totalStrokes;
      });

    return leaderboard.slice(0, limit);
  }

  static clearAllScores(): void {
    localStorage.removeItem(LEADERBOARD_KEY);
  }
}
