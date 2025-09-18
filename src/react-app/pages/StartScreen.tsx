import { useState, useEffect } from "react";
import { Play, Trophy, Target, Zap } from "lucide-react";
import { useNavigate } from "react-router";
import Leaderboard from "../components/Leaderboard";

export default function StartScreen() {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);

    // Load existing name if stored
    const existing = localStorage.getItem("playerName");
    if (existing) {
      setSavedName(existing);
      setName(existing);
    }

    return () => clearTimeout(timer);
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-white/8 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>

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
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl mb-6 shadow-2xl">
              <Target className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
              PuttPro
            </h1>

            <p className="text-xl text-white/90 font-medium">
              Professional 3D Minigolf Experience
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-xl">
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                5 Challenging Levels
              </h3>
              <p className="text-white/80 text-sm">
                Progressive difficulty with unique obstacles
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-xl">
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Realistic Physics
              </h3>
              <p className="text-white/80 text-sm">
                Advanced ball physics and terrain interaction
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-xl">
              <div className="w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Precision Control
              </h3>
              <p className="text-white/80 text-sm">
                Intuitive aiming with power control
              </p>
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
              className="group bg-white text-gray-800 px-12 py-4 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 hover:bg-gray-50 flex items-center justify-center gap-3 mx-auto"
            >
              <Play className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
              {savedName ? "Continue" : "Start Playing"}
            </button>

            <p className="text-white/70 text-sm">
              Click and drag to aim • Release to shoot • Mouse wheel to zoom
            </p>
          </div>

          {/* Version info */}
          <div className="mt-8 text-white/50 text-xs">
            Ready to master the perfect putt?
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
