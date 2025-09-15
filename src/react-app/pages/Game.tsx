import { useEffect, useRef, useState } from 'react';
import { Pause, Volume2, Trophy, ArrowRight, RotateCcw as Replay } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export default function Game() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialLevel = parseInt(queryParams.get('level') || '1', 10);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const [currentLevel, setCurrentLevel] = useState(initialLevel);
  const [showCongrats, setShowCongrats] = useState(false);
  const [completedStrokes, setCompletedStrokes] = useState(0);
  const [showPause, setShowPause] = useState(false);
  const [instructionIntro, setInstructionIntro] = useState(false);

  const initializeGame = (level: number) => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.dispose();
    }

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      
      import('../game/GameEngine').then(({ GameEngine }) => {
        gameInstanceRef.current = new GameEngine(canvas, level, (_, strokes) => {
          setCompletedStrokes(strokes);
          setShowCongrats(true);
          // Persist progress immediately when a level is completed
          const saved = localStorage.getItem('levelsData');
          let levelsData = saved ? JSON.parse(saved) : [];
          const idx = levelsData.findIndex((l: any) => l.id === level);
          if (idx !== -1) {
            const best = levelsData[idx].bestScore;
            if (best === null || strokes < best) {
              levelsData[idx].bestScore = strokes;
            }
            if (idx + 1 < levelsData.length) {
              levelsData[idx + 1].isUnlocked = true;
            }
            localStorage.setItem('levelsData', JSON.stringify(levelsData));
          }
        });
        gameInstanceRef.current.start();
      });
    }
  };

  useEffect(() => {
    initializeGame(currentLevel);

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.dispose();
      }
    };
  }, [currentLevel]);

  // Level 1 instruction intro animation
  useEffect(() => {
    if (currentLevel === 1) {
      setInstructionIntro(true);
      const timer = setTimeout(() => setInstructionIntro(false), 1000);
      return () => clearTimeout(timer);
    } else {
      setInstructionIntro(false);
    }
  }, [currentLevel]);

  const resetLevel = () => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.resetBall();
    }
  };

  const toggleMute = () => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.toggleMute();
    }
  };

  const nextLevel = () => {
    setShowCongrats(false);
    
    // Update local storage with best score and unlock next level
    const savedLevels = localStorage.getItem('levelsData');
    let levelsData = savedLevels ? JSON.parse(savedLevels) : [];

    const currentLevelIndex = levelsData.findIndex((level: any) => level.id === currentLevel);
    if (currentLevelIndex !== -1) {
      // Update best score if current strokes are better or no best score exists
      if (levelsData[currentLevelIndex].bestScore === null || completedStrokes < levelsData[currentLevelIndex].bestScore) {
        levelsData[currentLevelIndex].bestScore = completedStrokes;
      }

      // Unlock next level if it exists
      if (currentLevelIndex + 1 < levelsData.length) {
        levelsData[currentLevelIndex + 1].isUnlocked = true;
      }
    }

    localStorage.setItem('levelsData', JSON.stringify(levelsData));
    navigate('/levels'); // Navigate back to level selection
  };

  const handleNextLevel = () => {
    setShowCongrats(false);
    setCompletedStrokes(0);
    setCurrentLevel(prevLevel => prevLevel + 1);
  };

  const replayLevel = () => {
    setShowCongrats(false);
    setCompletedStrokes(0);
    initializeGame(currentLevel);
  };

  const getParForLevel = (level: number) => {
    if (level === 1) return 3;
    if (level === 2) return 4;
    if (level === 3) return 5;
    if (level === 4) return 4; // Example par for level 4
    if (level === 5) return 5; // Example par for level 5
    return 3;
  };

  const getScoreDescription = (strokes: number, par: number) => {
    const difference = strokes - par;
    if (difference <= -2) return "Eagle! 🦅";
    if (difference === -1) return "Birdie! 🐦";
    if (difference === 0) return "Par! ⭐";
    if (difference === 1) return "Bogey 📈";
    if (difference === 2) return "Double Bogey 📈📈";
    return "Keep practicing! 💪";
  };

  const openPause = () => setShowPause(true);
  const closePause = () => setShowPause(false);
  const goToLevels = () => navigate('/levels');

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600">
      {/* Game Canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-pointer"
      />
      
      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top HUD */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-auto">
          {/* Score Panel */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg">
            <div className="text-lg font-bold text-gray-800">Level {currentLevel}</div>
            <div className="text-sm text-gray-600">Par {getParForLevel(currentLevel)} • Strokes: <span className="font-semibold">0</span></div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={openPause}
              className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg hover:bg-white/100 transition-colors"
              title="Pause"
            >
              <Pause className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={toggleMute}
              className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg hover:bg-white/100 transition-colors"
              title="Toggle Sound"
            >
              <Volume2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Power Meter */}
        <div className="absolute bottom-20 left-4 pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
            <div className="text-sm font-semibold text-gray-700 mb-2">Power</div>
            <div className="w-6 h-32 bg-gray-200 rounded-full relative overflow-hidden">
              <div 
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 rounded-full transition-all duration-100"
                style={{ height: '0%' }}
                id="power-meter"
              />
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div
          className={
            `absolute backdrop-blur-sm rounded-lg p-4 shadow-lg pointer-events-auto max-w-xs 
            transform-gpu will-change-transform transition-[transform,background-color,opacity,top,right,bottom,left] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] 
            ${instructionIntro
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-150 bg-white/90 z-50'
              : 'bottom-4 right-4 translate-x-0 translate-y-0 scale-100 bg-white/20'}`
          }
        >
          <div className="text-sm text-gray-700">
            <div className="font-semibold mb-2">Controls:</div>
            <div className="space-y-1">
              <div>• Click & drag to aim</div>
              <div>• Release to shoot</div>
              <div>• Mouse wheel to zoom</div>
              <div>• Right click to pan camera</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pause Modal */}
      {showPause && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Paused</h2>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowPause(false); replayLevel(); }}
                className="w-full bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Restart
              </button>
              <button
                onClick={goToLevels}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Level selector
              </button>
              <button
                onClick={closePause}
                className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Congratulations Modal */}
      {showCongrats && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl transform animate-pulse">
            <div className="text-center">
              <div className="mb-4">
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
              </div>
              
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                🎉 Congratulations! 🎉
              </h2>
              
              <p className="text-lg text-gray-600 mb-2">
                Level {currentLevel} Complete!
              </p>
              
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <p className="text-lg font-semibold text-green-800">
                  {completedStrokes} strokes
                </p>
                <p className="text-sm text-green-600">
                  {getScoreDescription(completedStrokes, getParForLevel(currentLevel))}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={replayLevel}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  <Replay className="w-5 h-5" />
                  Replay
                </button>
                
                {currentLevel < 5 && (
                  <button
                    onClick={handleNextLevel}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                    Next Level
                  </button>
                )}

                <button
                  onClick={nextLevel} // This now navigates to /levels
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                  Go to Levels
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aiming Line Overlay */}
      <div 
        id="aiming-line" 
        className="absolute pointer-events-none hidden"
        style={{
          width: '2px',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.3))',
          transformOrigin: 'top center'
        }}
      />
    </div>
  );
}
