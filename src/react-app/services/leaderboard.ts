import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from './firebase';
import { LeaderboardEntry } from '@/shared/types';

const LEADERBOARD_KEY = 'golfLeaderboard';

export class LeaderboardService {
  private static readonly COLLECTION_NAME = 'leaderboard';

  static async addScore(playerName: string, level: number, strokes: number, userId?: string): Promise<void> {
    try {
      const entry = {
        playerName: playerName.trim(),
        level,
        strokes,
        timestamp: serverTimestamp(),
        userId: userId || null,
      };

      await addDoc(collection(db, this.COLLECTION_NAME), entry);
    } catch (error) {
      console.error('Error adding score to leaderboard:', error);
      // Fallback to localStorage
      this.addScoreLocal(playerName, level, strokes);
    }
  }

  static async getAllEntries(): Promise<LeaderboardEntry[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          playerName: data.playerName,
          level: data.level,
          strokes: data.strokes,
          timestamp: data.timestamp?.toMillis() || Date.now(),
        };
      });
    } catch (error) {
      console.error('Error fetching leaderboard entries:', error);
      // Fallback to localStorage
      return this.getAllEntriesLocal();
    }
  }

  static async getTopScoresForLevel(level: number, maxLimit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('level', '==', level),
        orderBy('strokes', 'asc'),
        orderBy('timestamp', 'asc'),
        limit(maxLimit)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          playerName: data.playerName,
          level: data.level,
          strokes: data.strokes,
          timestamp: data.timestamp?.toMillis() || Date.now(),
        };
      });
    } catch (error) {
      console.error('Error fetching top scores for level:', error);
      // Fallback to localStorage
      const allEntries = this.getAllEntriesLocal();
      return allEntries
        .filter(entry => entry.level === level)
        .sort((a, b) => {
          if (a.strokes !== b.strokes) {
            return a.strokes - b.strokes;
          }
          return a.timestamp - b.timestamp;
        })
        .slice(0, maxLimit);
    }
  }

  static async getPlayerBestForLevel(playerName: string, level: number): Promise<LeaderboardEntry | null> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('playerName', '==', playerName),
        where('level', '==', level),
        orderBy('strokes', 'asc'),
        orderBy('timestamp', 'asc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        playerName: data.playerName,
        level: data.level,
        strokes: data.strokes,
        timestamp: data.timestamp?.toMillis() || Date.now(),
      };
    } catch (error) {
      console.error('Error fetching player best score:', error);
      return null;
    }
  }

  static async getOverallLeaderboard(maxLimit: number = 20): Promise<{ playerName: string; totalStrokes: number; levelsCompleted: number }[]> {
    try {
      const allEntries = await this.getAllEntries();
      const playerStats = new Map<string, { totalStrokes: number; levels: Set<number>; bestPerLevel: Map<number, number> }>();

      // Process entries to get best score for each player per level
      allEntries.forEach(entry => {
        const existing = playerStats.get(entry.playerName) || { 
          totalStrokes: 0, 
          levels: new Set(), 
          bestPerLevel: new Map() 
        };
        
        const currentBest = existing.bestPerLevel.get(entry.level);
        if (!currentBest || entry.strokes < currentBest) {
          // Update best score for this level
          if (currentBest) {
            existing.totalStrokes -= currentBest;
          }
          existing.totalStrokes += entry.strokes;
          existing.bestPerLevel.set(entry.level, entry.strokes);
          existing.levels.add(entry.level);
        }
        
        playerStats.set(entry.playerName, existing);
      });

      // Convert to array and sort
      const leaderboard = Array.from(playerStats.entries())
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

      return leaderboard.slice(0, maxLimit);
    } catch (error) {
      console.error('Error fetching overall leaderboard:', error);
      return [];
    }
  }

  static async clearAllScores(): Promise<void> {
    try {
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      const deletePromises = querySnapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, this.COLLECTION_NAME, docSnapshot.id))
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error clearing leaderboard:', error);
      localStorage.removeItem(LEADERBOARD_KEY);
    }
  }

  // Fallback methods for localStorage
  static addScoreLocal(playerName: string, level: number, strokes: number): void {
    const entry: LeaderboardEntry = {
      playerName: playerName.trim(),
      level,
      strokes,
      timestamp: Date.now(),
    };

    const existingEntries = this.getAllEntriesLocal();
    existingEntries.push(entry);
    
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(existingEntries));
  }

  static getAllEntriesLocal(): LeaderboardEntry[] {
    const stored = localStorage.getItem(LEADERBOARD_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
}
