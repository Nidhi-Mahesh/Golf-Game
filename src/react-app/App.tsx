import { BrowserRouter as Router, Routes, Route } from "react-router";
import StartScreen from "@/react-app/pages/StartScreen";
import Game from "@/react-app/pages/Game";
import LevelSelectScreen from "@/react-app/pages/LevelSelectScreen";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/game" element={<Game />} />
        <Route path="/levels" element={<LevelSelectScreen />} />
      </Routes>
    </Router>
  );
}
