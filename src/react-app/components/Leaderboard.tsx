import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { LeaderboardService } from '../services/leaderboard';
import { LeaderboardEntry } from '@/shared/types';

interface LeaderboardProps {
  maxEntries?: number;
}

export default function Leaderboard({ maxEntries = 10 }: LeaderboardProps) {
  const [selectedLevel, setSelectedLevel] = useState<number | 'overall'>('overall');
  const [levelScores, setLevelScores] = useState<LeaderboardEntry[]>([]);
  const [overallScores, setOverallScores] = useState<{ playerName: string; totalStrokes: number; levelsCompleted: number }[]>([]);

  useEffect(() => {
    const loadScores = async () => {
      if (selectedLevel === 'overall') {
        const scores = await LeaderboardService.getOverallLeaderboard(maxEntries);
        setOverallScores(scores);
      } else {
        const scores = await LeaderboardService.getTopScoresForLevel(selectedLevel, maxEntries);
        setLevelScores(scores);
      }
    };

    loadScores();
  }, [selectedLevel, maxEntries]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <Star className="w-4 h-4 text-blue-500" />;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600 text-white';
      default:
        return 'bg-white/15 text-white';
    }
  };

  return (
    <div className="bg-white/15 backdrop-blur-sm rounded-xl p-6 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-4 text-center flex items-center justify-center gap-2">
        <Trophy className="w-6 h-6 text-yellow-400" />
        Leaderboard
      </h2>

      {/* Level Selection */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        <button
          onClick={() => setSelectedLevel('overall')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            selectedLevel === 'overall'
              ? 'bg-white/25 text-white'
              : 'bg-white/8 text-white/70 hover:bg-white/15'
          }`}
        >
          Overall
        </button>
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            onClick={() => setSelectedLevel(level)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              selectedLevel === level
                ? 'bg-white/25 text-white'
                : 'bg-white/8 text-white/70 hover:bg-white/15'
            }`}
          >
            Level {level}
          </button>
        ))}
      </div>

      {/* Leaderboard Content */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {selectedLevel === 'overall' ? (
          overallScores.length > 0 ? (
            overallScores.map((entry, index) => (
              <div
                key={`${entry.playerName}-overall`}
                className={`flex items-center gap-3 p-3 rounded-lg ${getRankColor(index + 1)}`}
              >
                <div className="flex items-center gap-2">
                  {getRankIcon(index + 1)}
                  <span className="font-bold text-sm">#{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{entry.playerName}</div>
                  <div className="text-xs opacity-90">
                    {entry.levelsCompleted} levels • {entry.totalStrokes} total strokes
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-white/70 py-4">
              No scores yet. Be the first to complete a level!
            </div>
          )
        ) : (
          levelScores.length > 0 ? (
            levelScores.map((entry, index) => (
              <div
                key={`${entry.playerName}-${entry.level}-${entry.timestamp}`}
                className={`flex items-center gap-3 p-3 rounded-lg ${getRankColor(index + 1)}`}
              >
                <div className="flex items-center gap-2">
                  {getRankIcon(index + 1)}
                  <span className="font-bold text-sm">#{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{entry.playerName}</div>
                  <div className="text-xs opacity-90">
                    {entry.strokes} strokes
                  </div>
                </div>
                <div className="text-xs opacity-75">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-white/70 py-4">
              No scores for Level {selectedLevel} yet.
            </div>
          )
        )}
      </div>

      {selectedLevel === 'overall' && overallScores.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="text-xs text-white/70 text-center">
            Overall ranking based on levels completed and total strokes
          </div>
        </div>
      )}
    </div>
  );
}
