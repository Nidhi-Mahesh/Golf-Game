import { useState, useEffect, useRef } from "react";
import { Play, Trophy, Target, Zap, Volume2, VolumeX, Flag, Music } from "lucide-react";
import { useNavigate } from "react-router";
import Leaderboard from "../components/Leaderboard";

export default function StartScreen() {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [titleText, setTitleText] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullTitle = "PuttPro";

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);

    // Load existing name if stored
    const existing = localStorage.getItem("playerName");
    if (existing) {
      setSavedName(existing);
      setName(existing);
    }

    // Typewriter effect for title
    let titleTimer: NodeJS.Timeout;
    let currentIndex = 0;
    
    const typeTitle = () => {
      if (currentIndex < fullTitle.length) {
        setTitleText(fullTitle.slice(0, currentIndex + 1));
        currentIndex++;
        titleTimer = setTimeout(typeTitle, 150);
      }
    };
    
    const titleDelay = setTimeout(typeTitle, 800);

    // Mouse movement tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearTimeout(timer);
      clearTimeout(titleTimer);
      clearTimeout(titleDelay);
      document.removeEventListener('mousemove', handleMouseMove);
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
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center p-4 overflow-hidden relative"
    >
      {/* Enhanced animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-white/8 rounded-full blur-xl animate-pulse delay-500"></div>
        
        {/* Floating particles */}
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full particle-animation"
            style={{
              left: `${10 + (i * 7) % 80}%`,
              top: `${10 + (i * 11) % 80}%`,
              animationDelay: `${i * 0.5}s`,
              transform: `translate(${mousePosition.x * 20 - 10}px, ${mousePosition.y * 20 - 10}px)`,
              transition: 'transform 0.5s ease-out'
            }}
          />
        ))}
        
        {/* Interactive golf ball */}
        <div 
          className="absolute w-16 h-16 bg-white rounded-full shadow-2xl border-4 border-white/50 glow-effect float-animation"
          style={{
            right: `${20 + mousePosition.x * 10}%`,
            top: `${20 + mousePosition.y * 15}%`,
            transform: `rotate(${mousePosition.x * 360}deg) scale(${1 + mousePosition.y * 0.2})`,
            transition: 'all 0.3s ease-out',
            background: 'radial-gradient(circle at 30% 30%, #ffffff, #f0f0f0, #e0e0e0)'
          }}
        >
          {/* Golf ball dimples */}
          <div className="absolute inset-0 rounded-full">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-black/10 rounded-full"
                style={{
                  left: `${30 + (i % 3) * 20}%`,
                  top: `${30 + Math.floor(i / 3) * 15}%`
                }}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Sound toggle */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className="absolute top-6 right-6 z-10 bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition-all duration-300 hover:scale-110"
      >
        {soundEnabled ? (
          <Volume2 className="w-6 h-6 text-white" />
        ) : (
          <VolumeX className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Main content */}
      <div className="relative w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left side - Main game info */}
        <div
          className={`lg:col-span-2 text-center transform transition-all duration-1000 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          {/* Logo/Title Section */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl mb-6 shadow-2xl hover:scale-110 hover:rotate-6 transition-all duration-500 cursor-pointer group">
              <Target className="w-12 h-12 text-white group-hover:scale-125 transition-transform duration-300" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>

            <h1 className="text-6xl font-bold text-white mb-4 tracking-tight font-mono relative">
              <span className="relative z-10">{titleText}</span>
              <span className="animate-pulse text-white/70 ml-1">|</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-50"></div>
            </h1>

            <p className="text-xl text-white/90 font-medium animate-bounce">
              Professional 3D Minigolf Experience 🏌️‍♂️
            </p>
            
            {/* Interactive golf course elements */}
            <div className="flex justify-center items-center mt-4 space-x-4">
              <div className="relative group cursor-pointer">
                <Flag className="w-6 h-6 text-white/70 hover:text-white transition-colors duration-300 hover:scale-125" />
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
              <div className="w-4 h-1 bg-green-400 rounded-full hover:w-6 transition-all duration-300 cursor-pointer"></div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div 
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-xl cursor-pointer transition-all duration-500 hover:scale-105 hover:bg-white/20 hover:shadow-2xl hover:-translate-y-2 group ${
                hoveredCard === 0 ? 'ring-4 ring-white/50' : ''
              }`}
              onMouseEnter={() => setHoveredCard(0)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
                <Trophy className="w-6 h-6 text-white group-hover:text-yellow-300 transition-colors duration-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-100 transition-colors duration-300">
                5 Challenging Levels
              </h3>
              <p className="text-white/80 text-sm group-hover:text-white/90 transition-colors duration-300">
                Progressive difficulty with unique obstacles
              </p>
              <div className="mt-4 h-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            </div>

            <div 
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-xl cursor-pointer transition-all duration-500 hover:scale-105 hover:bg-white/20 hover:shadow-2xl hover:-translate-y-2 group ${
                hoveredCard === 1 ? 'ring-4 ring-white/50' : ''
              }`}
              onMouseEnter={() => setHoveredCard(1)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
                <Zap className="w-6 h-6 text-white group-hover:text-blue-300 transition-colors duration-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-100 transition-colors duration-300">
                Realistic Physics
              </h3>
              <p className="text-white/80 text-sm group-hover:text-white/90 transition-colors duration-300">
                Advanced ball physics and terrain interaction
              </p>
              <div className="mt-4 h-1 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            </div>

            <div 
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-xl cursor-pointer transition-all duration-500 hover:scale-105 hover:bg-white/20 hover:shadow-2xl hover:-translate-y-2 group ${
                hoveredCard === 2 ? 'ring-4 ring-white/50' : ''
              }`}
              onMouseEnter={() => setHoveredCard(2)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
                <Target className="w-6 h-6 text-white group-hover:text-green-300 transition-colors duration-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-green-100 transition-colors duration-300">
                Precision Control
              </h3>
              <p className="text-white/80 text-sm group-hover:text-white/90 transition-colors duration-300">
                Intuitive aiming with power control
              </p>
              <div className="mt-4 h-1 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            </div>
          </div>

          {/* Username Input */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-xl mb-6 max-w-md mx-auto">
            <label className="block text-white/90 font-medium mb-2 text-lg">
              Enter your name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your username"
              className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Play Button */}
          <div className="space-y-4">
            <button
              onClick={startGame}
              className="group relative bg-white text-gray-800 px-12 py-4 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 hover:bg-gray-50 flex items-center justify-center gap-3 mx-auto overflow-hidden"
              onMouseEnter={() => soundEnabled && console.log('Play hover sound')}
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              <Play className="w-6 h-6 group-hover:translate-x-1 group-hover:scale-110 transition-all duration-300 relative z-10" />
              <span className="relative z-10">{savedName ? "Continue" : "Start Playing"}</span>
              
              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/50 scale-105 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500"></div>
            </button>
            
            {/* Interactive instruction text */}
            <div className="text-center space-y-2">
              <p className="text-white/70 text-sm hover:text-white/90 transition-colors duration-300 cursor-pointer">
                🖱️ Click and drag to aim • 🎯 Release to shoot • 🔍 Mouse wheel to zoom
              </p>
              <div className="flex justify-center space-x-4 text-xs text-white/50">
                <span className="hover:text-white/80 transition-colors duration-300 cursor-pointer">🏆 High Score</span>
                <span className="hover:text-white/80 transition-colors duration-300 cursor-pointer">⚡ Power Shot</span>
                <span className="hover:text-white/80 transition-colors duration-300 cursor-pointer">🎮 Precision Mode</span>
              </div>
            </div>
          </div>

          {/* Version info */}
          <div className="mt-8 space-y-2">
            <p className="text-white/50 text-xs hover:text-white/70 transition-colors duration-300 cursor-pointer">
              Ready to master the perfect putt? ⛳
            </p>
            <div className="flex justify-center space-x-2 text-white/30 text-xs">
              <span className="hover:text-emerald-300 transition-colors duration-300 cursor-pointer">v2.0</span>
              <span>•</span>
              <span className="hover:text-emerald-300 transition-colors duration-300 cursor-pointer">3D Physics</span>
              <span>•</span>
              <span className="hover:text-emerald-300 transition-colors duration-300 cursor-pointer">Made with ❤️</span>
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
