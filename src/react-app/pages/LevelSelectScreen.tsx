import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Lock } from 'lucide-react';

const MAX_LEVELS = 4; // Game now has 4 levels

interface LevelData {
  id: number;
  bestScore: number | null;
  isUnlocked: boolean;
}

export default function LevelSelectScreen() {
  const navigate = useNavigate();
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [lastLevelsJson, setLastLevelsJson] = useState<string>('');

  // Load from localStorage, creating defaults if missing
  const loadLevels = () => {
    const savedLevels = localStorage.getItem('levelsData');
    if (savedLevels) {
      const parsedLevels = JSON.parse(savedLevels);
      // Filter to only include levels 1-4, removing any level 5 data
      const filteredLevels = parsedLevels.filter((level: LevelData) => level.id <= MAX_LEVELS);
      
      if (savedLevels !== lastLevelsJson || filteredLevels.length !== parsedLevels.length) {
        setLevels(filteredLevels);
        const newJson = JSON.stringify(filteredLevels);
        setLastLevelsJson(newJson);
        // Update localStorage to remove level 5 if it existed
        localStorage.setItem('levelsData', newJson);
      }
    } else {
      const initialLevels: LevelData[] = Array.from({ length: MAX_LEVELS }, (_, i) => ({
        id: i + 1,
        bestScore: null,
        isUnlocked: i === 0,
      }));
      const json = JSON.stringify(initialLevels);
      setLevels(initialLevels);
      setLastLevelsJson(json);
      localStorage.setItem('levelsData', json);
    }
  };

  useEffect(() => {
    loadLevels();
    // Refresh periodically while on this screen so it "keeps updating"
    const interval = setInterval(loadLevels, 1000);
    // Update on tab focus or external changes
    const onFocus = () => loadLevels();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'levelsData') loadLevels();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleLevelClick = (levelId: number) => {
    const selectedLevel = levels.find(level => level.id === levelId);
    if (selectedLevel?.isUnlocked) {
      navigate(`/game?level=${levelId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold text-white mb-12 tracking-tight">LEVEL SELECT</h1>
      <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => handleLevelClick(level.id)}
            className={`relative flex flex-col items-center justify-center p-4 rounded-lg shadow-lg text-white font-bold text-2xl
              ${level.isUnlocked ? 'bg-blue-500 hover:bg-blue-600 cursor-pointer' : 'bg-gray-700 cursor-not-allowed opacity-70'}
            `}
            disabled={!level.isUnlocked}
          >
            {level.isUnlocked ? (
              <>
                {level.id}
                <span className="text-sm font-normal mt-1">Best {level.bestScore !== null ? level.bestScore : '-'}</span>
              </>
            ) : (
              <Lock className="w-8 h-8 text-gray-400" />
            )}
            {!level.isUnlocked && <span className="absolute inset-0 flex items-center justify-center text-sm font-normal text-gray-400">Best -</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
