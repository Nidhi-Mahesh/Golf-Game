import { useEffect, useRef, useState } from 'react';
import { Pause, Volume2, Trophy, ArrowRight, RotateCcw as Replay } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { LeaderboardService } from '../services/leaderboard';
import { audioService } from '../services/audioService';

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
  const [showBoundaryWarning, setShowBoundaryWarning] = useState(false);

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
          
          // Play celebratory sound
          audioService.playCelebrationSound();
          
          // Get player name and add to leaderboard
          const playerName = localStorage.getItem('playerName') || 'Anonymous';
          LeaderboardService.addScore(playerName, level, strokes);
          
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
      // Don't dispose audio service on level changes - only dispose on app shutdown
      // audioService.dispose();
    };
  }, [currentLevel]);

  // Level instruction intro animation
  useEffect(() => {
    if (currentLevel === 1) {
      setInstructionIntro(true);
      const timer = setTimeout(() => setInstructionIntro(false), 1000);
      return () => clearTimeout(timer);
    }
    if (currentLevel === 5) {
      // Show boundary warning for level 5 (circular course) for 3 seconds
      setShowBoundaryWarning(true);
      const timer2 = setTimeout(() => setShowBoundaryWarning(false), 3000);
      return () => clearTimeout(timer2);
    }
    setInstructionIntro(false);
    setShowBoundaryWarning(false);
  }, [currentLevel]);

  const resetLevel = () => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.resetBall();
    }
  };

  const toggleMute = () => {
    // Toggle mute in our audio service
    const isMuted = audioService.toggleMute();
    
    // Also toggle mute in game engine if it exists
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
    if (level === 1) return 3; // Simple 3-block layout
    if (level === 2) return 5; // Bumpy terrain (was Level 3)
    if (level === 3) return 4; // Spiral slide course
    if (level === 4) return 4; // Multi-tier platforms (new)
    if (level === 5) return 4; // Circular course (was Level 2)
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
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-green-300 via-green-400 to-green-600">
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
          <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg">
            <div className="text-lg font-bold text-gray-800">Level {currentLevel}</div>
            <div className="text-sm text-gray-600">Par {getParForLevel(currentLevel)} • Strokes: <span className="font-semibold">0</span></div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={openPause}
              className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg hover:bg-white/100 transition-colors"
              title="Pause"
            >
              <Pause className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={toggleMute}
              className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg hover:bg-white/100 transition-colors"
              title="Toggle Sound"
            >
              <Volume2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Power Meter */}
        <div className="absolute bottom-20 left-4 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg">
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
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-150 bg-white/95 z-50'
              : 'bottom-4 right-4 translate-x-0 translate-y-0 scale-100 bg-white/30'}`
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
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50 p-4">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gray-100">
            <div className="text-center">
              {/* Trophy Icon */}
              <div className="mb-4">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto" />
              </div>
              
              {/* Main Title */}
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  🎉 Congratulations! 🎉
                </h2>
                <p className="text-lg text-gray-600">
                  Level {currentLevel} Complete!
                </p>
              </div>
              
              {/* Score Card */}
              <div className="bg-green-50 rounded-xl p-4 mb-5 border border-green-200">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{completedStrokes}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-green-600 font-medium uppercase">Strokes</p>
                    <p className="text-sm font-bold text-green-800">
                      Par {getParForLevel(currentLevel)}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-green-800">
                  {getScoreDescription(completedStrokes, getParForLevel(currentLevel))}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Primary Actions */}
                <div className="flex gap-2">
                  {currentLevel < 5 && (
                    <button
                      onClick={handleNextLevel}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Next
                    </button>
                  )}
                  
                  <button
                    onClick={nextLevel}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Levels
                  </button>
                </div>
                
                {/* Secondary Action */}
                <button
                  onClick={replayLevel}
                  className="w-full flex items-center justify-center gap-2 bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  <Replay className="w-4 h-4" />
                  Replay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boundary Warning Modal for Level 5 */}
      {showBoundaryWarning && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl transform animate-bounce">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">⚠️</span>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                ⚠️ Level 5 Warning!
              </h2>
              
              <p className="text-lg text-gray-600 mb-2">
                Circular Course - Stay Within Boundaries!
              </p>
              
              <div className="bg-red-50 rounded-lg p-4 mb-2">
                <p className="text-md font-semibold text-red-800">
                  Be careful not to fall off the circular platform!
                </p>
                <p className="text-sm text-red-600 mt-1">
                  The ball will reset if it goes out of bounds.
                </p>
              </div>
              
              <div className="text-xs text-gray-500">
                This message will disappear in 3 seconds...
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