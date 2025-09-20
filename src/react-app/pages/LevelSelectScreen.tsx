import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom"; // fixed import
import { Lock, Home as HomeIcon } from "lucide-react";

// Import the background image
const backgroundImageUrl = '/images/levels.png';

const MAX_LEVELS = 5; // Game now has 5 levels

interface LevelData {
  id: number;
  bestScore: number | null;
  isUnlocked: boolean;
}

export default function LevelSelectScreen() {
  const navigate = useNavigate();
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [lastLevelsJson, setLastLevelsJson] = useState<string>("");

  // Load from localStorage, creating defaults if missing
  const loadLevels = () => {
    const savedLevels = localStorage.getItem("levelsData");
    let levelsToSet: LevelData[] = [];
    
    if (savedLevels) {
      try {
        const parsedLevels = JSON.parse(savedLevels);
        // Create a map of existing levels for easy lookup
        const levelMap = new Map<number, LevelData>();
        parsedLevels.forEach((level: LevelData) => {
          if (level.id <= MAX_LEVELS) {
            levelMap.set(level.id, level);
          }
        });
        
        // Ensure all 5 levels exist, preserving existing data
        for (let i = 1; i <= MAX_LEVELS; i++) {
          if (levelMap.has(i)) {
            levelsToSet.push(levelMap.get(i)!);
          } else {
            // Create missing level
            levelsToSet.push({
              id: i,
              bestScore: null,
              isUnlocked: i === 1, // Only level 1 is unlocked by default
            });
          }
        }
      } catch (error) {
        console.error('Error parsing saved levels:', error);
        // Fall back to initial levels if parsing fails
        levelsToSet = Array.from(
          { length: MAX_LEVELS },
          (_, i) => ({
            id: i + 1,
            bestScore: null,
            isUnlocked: i === 0,
          })
        );
      }
    } else {
      // No saved data, create initial levels
      levelsToSet = Array.from(
        { length: MAX_LEVELS },
        (_, i) => ({
          id: i + 1,
          bestScore: null,
          isUnlocked: i === 0,
        })
      );
    }
    
    const newJson = JSON.stringify(levelsToSet);
    if (newJson !== lastLevelsJson) {
      setLevels(levelsToSet);
      setLastLevelsJson(newJson);
      localStorage.setItem('levelsData', newJson);
    }
  };

  useEffect(() => {
    loadLevels();
    const interval = setInterval(loadLevels, 1000);

    const onFocus = () => loadLevels();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "levelsData") loadLevels();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleLevelClick = (levelId: number) => {
    const selectedLevel = levels.find((level) => level.id === levelId);
    if (selectedLevel?.isUnlocked) {
      navigate(`/game?level=${levelId}`);
    }
  };

  const getLevelDescription = (levelId: number) => {
    switch (levelId) {
      case 1:
        return "Simple Course";
      case 2:
        return "Bumpy Terrain";
      case 3:
        return "Roller Coaster";
      case 4:
        return "Moving Blocks";
      case 5:
        return "Circular Challenge";
      default:
        return `Level ${levelId}`;
    }
  };

  const getLevelColor = (levelId: number, isUnlocked: boolean) => {
    if (!isUnlocked) return "bg-gray-700 cursor-not-allowed opacity-70";
    
    switch (levelId) {
      case 1:
        return "bg-green-500 hover:bg-green-600 cursor-pointer";
      case 2:
        return "bg-blue-500 hover:bg-blue-600 cursor-pointer";
      case 3:
        return "bg-purple-500 hover:bg-purple-600 cursor-pointer";
      case 4:
        return "bg-orange-500 hover:bg-orange-600 cursor-pointer";
      case 5:
        return "bg-red-500 hover:bg-red-600 cursor-pointer shadow-2xl ring-4 ring-red-300";
      default:
        return "bg-gray-500 hover:bg-gray-600 cursor-pointer";
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image with multiple fallback attempts */}
      <img 
        src={backgroundImageUrl}
        alt="Golf course background"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          zIndex: 1
        }}
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          const currentSrc = img.src;
          console.log('Background image failed to load:', currentSrc);
          
          // Try different paths
          if (currentSrc.includes('/images/levels.png')) {
            img.src = './images/levels.png';
          } else if (currentSrc.includes('./images/levels.png')) {
            img.src = 'images/levels.png';
          } else if (currentSrc.includes('images/levels.png')) {
            img.src = '/public/images/levels.png';
          } else {
            img.style.display = 'none';
          }
        }}
        onLoad={() => console.log('Background image loaded successfully')}
      />
      
      {/* Fallback gradient background if image doesn't load */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600" style={{ zIndex: 0 }} />
      
      {/* Content overlay */}
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-start pt-20 p-4">
        {/* Home button */}
        <div className="absolute top-4 left-4">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/90 text-white hover:bg-blue-700/90 shadow-md backdrop-blur-sm transition-colors"
          >
            <HomeIcon className="w-5 h-5" />
            Home
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-white mb-6 tracking-tight text-center drop-shadow-lg">
          LEVEL SELECT
        </h1>

        <div className="grid grid-cols-5 gap-3 max-w-2xl mx-auto">
          {levels.map((level) => (
            <div key={level.id} className="flex flex-col items-center">
              <button
                onClick={() => handleLevelClick(level.id)}
                className={`relative flex flex-col items-center justify-center p-3 rounded-lg shadow-lg text-white font-bold text-lg transition-all duration-300 transform hover:scale-110 min-h-[80px] w-full max-w-[100px] backdrop-blur-sm
                  ${getLevelColor(level.id, level.isUnlocked)}
                `}
                disabled={!level.isUnlocked}
              >
                {level.isUnlocked ? (
                  <>
                    <div className="text-2xl mb-1">{level.id}</div>
                    <span className="text-xs font-normal opacity-90 text-center">
                      Best {level.bestScore !== null ? level.bestScore : "-"}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs font-normal text-gray-400">
                      Locked
                    </span>
                  </>
                )}
                {level.id === 5 && level.isUnlocked && (
                  <div className="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                    NEW
                  </div>
                )}
              </button>
              <div className="mt-1 text-center">
                <span className="text-white text-xs font-medium drop-shadow">
                  {getLevelDescription(level.id)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
