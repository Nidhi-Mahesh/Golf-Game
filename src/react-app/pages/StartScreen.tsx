import { useState, useEffect, useRef } from "react";
import { Play, Trophy, Target, Zap, Volume2, VolumeX, Flag, Music } from "lucide-react";
import { useNavigate } from "react-router";
import Leaderboard from "../components/Leaderboard";

export default function StartScreen() {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);

    // Load existing name if stored
    const existing = localStorage.getItem("playerName");
    if (existing) {
      setSavedName(existing);
      setName(existing);
    }

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const startGame = () => {
    if (name.trim() === "") {
      alert("Please enter your name first!");
      return;
    }
    localStorage.setItem("playerName", name.trim());
    navigate("/levels");
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-emerald-400/80 via-teal-500/80 to-cyan-600/80 flex items-center justify-center p-4 overflow-hidden relative"
      style={{
        backgroundImage: 'url(/images/landing.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Background overlay for better readability */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* Sound toggle */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className="absolute top-6 right-6 z-10 bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition-colors duration-200"
      >
        {soundEnabled ? (
          <Volume2 className="w-6 h-6 text-white" />
        ) : (
          <VolumeX className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Main content */}
      <div className="relative w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12 items-start px-4">
        {/* Left side - Main game info */}
        <div
          className={`lg:col-span-2 text-center transform transition-all duration-1000 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          {/* Logo/Title Section */}
          <div className="mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl mb-6 shadow-2xl">
              <Target className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-7xl font-bold text-white mb-6 tracking-tight font-mono drop-shadow-2xl">
              Go Golf
            </h1>

            <p className="text-2xl text-white font-medium drop-shadow-lg bg-black/20 backdrop-blur-sm rounded-2xl px-8 py-4 border border-white/20">
              Professional 3D Minigolf Experience
            </p>
            
            {/* Golf course elements */}
            <div className="flex justify-center items-center mt-4 space-x-4">
              <Flag className="w-6 h-6 text-white/70" />
              <div className="w-2 h-2 bg-black rounded-full"></div>
              <div className="w-4 h-1 bg-green-400 rounded-full"></div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div 
              className={`bg-white/15 backdrop-blur-md rounded-2xl p-8 shadow-2xl cursor-pointer transition-all duration-200 hover:bg-white/25 group border border-white/20 ${
                hoveredCard === 0 ? 'ring-2 ring-emerald-400/50 bg-white/20' : ''
              }`}
              onMouseEnter={() => setHoveredCard(0)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white group-hover:text-yellow-300 transition-colors duration-200" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-100 transition-colors duration-200">
                5 Challenging Levels
              </h3>
              <p className="text-white/80 text-sm group-hover:text-white/90 transition-colors duration-200">
                Progressive difficulty with unique obstacles
              </p>
            </div>

            <div 
              className={`bg-white/15 backdrop-blur-md rounded-2xl p-8 shadow-2xl cursor-pointer transition-all duration-200 hover:bg-white/25 group border border-white/20 ${
                hoveredCard === 1 ? 'ring-2 ring-blue-400/50 bg-white/20' : ''
              }`}
              onMouseEnter={() => setHoveredCard(1)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white group-hover:text-blue-300 transition-colors duration-200" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-100 transition-colors duration-200">
                Realistic Physics
              </h3>
              <p className="text-white/80 text-sm group-hover:text-white/90 transition-colors duration-200">
                Advanced ball physics and terrain interaction
              </p>
            </div>

            <div 
              className={`bg-white/15 backdrop-blur-md rounded-2xl p-8 shadow-2xl cursor-pointer transition-all duration-200 hover:bg-white/25 group border border-white/20 ${
                hoveredCard === 2 ? 'ring-2 ring-green-400/50 bg-white/20' : ''
              }`}
              onMouseEnter={() => setHoveredCard(2)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Target className="w-6 h-6 text-white group-hover:text-green-300 transition-colors duration-200" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-green-100 transition-colors duration-200">
                Precision Control
              </h3>
              <p className="text-white/80 text-sm group-hover:text-white/90 transition-colors duration-200">
                Intuitive aiming with power control
              </p>
            </div>
          </div>

          {/* Username Input */}
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8 shadow-2xl mb-8 max-w-lg mx-auto border border-white/30">
            <label className="block text-white font-semibold mb-4 text-xl drop-shadow-lg">
              Enter your name to begin:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your golf pro name..."
              className="w-full p-4 rounded-xl border-2 border-white/30 focus:outline-none focus:ring-4 focus:ring-emerald-400/50 focus:border-emerald-400 bg-white/90 backdrop-blur-sm text-gray-800 font-medium text-lg placeholder-gray-500 shadow-inner transition-all duration-300"
            />
          </div>

          {/* Play Button */}
          <div className="space-y-4">
            <button
              onClick={startGame}
              className="group relative bg-gradient-to-r from-white via-gray-50 to-white text-gray-800 px-16 py-5 rounded-3xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all duration-200 hover:from-emerald-50 hover:to-teal-50 flex items-center justify-center gap-4 mx-auto overflow-hidden border-2 border-white/50 hover:border-emerald-400/70"
              onMouseEnter={() => soundEnabled && console.log('Play hover sound')}
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              <Play className="w-6 h-6 relative z-10" />
              <span className="relative z-10">{savedName ? "Continue" : "Start Playing"}</span>
            </button>
            
            {/* Instruction text */}
            <div className="text-center space-y-2">
              <p className="text-white/70 text-sm">
                Click and drag to aim • Release to shoot • Mouse wheel to zoom
              </p>
              <div className="flex justify-center space-x-4 text-xs text-white/50">
                <span>High Score</span>
                <span>Power Shot</span>
                <span>Precision Mode</span>
              </div>
            </div>
          </div>

          {/* Version info */}
          <div className="mt-8 space-y-2">
            <p className="text-white/50 text-xs">
              Ready to master the perfect putt?
            </p>
            <div className="flex justify-center space-x-2 text-white/30 text-xs">
              <span>v2.0</span>
              <span>•</span>
              <span>3D Physics</span>
              <span>•</span>
              <span>Made with Love</span>
            </div>
          </div>
        </div>

        {/* Right side - Leaderboard */}
        <div
          className={`transform transition-all duration-1000 delay-300 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <Leaderboard maxEntries={8} />
        </div>
      </div>
    </div>
  );
}
