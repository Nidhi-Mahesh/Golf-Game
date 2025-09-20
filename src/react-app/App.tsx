import { BrowserRouter as Router, Routes, Route } from "react-router-dom"; 
// ^--- must be react-router-dom, not react-router

import { AuthProvider } from "@/react-app/contexts/AuthContext";
import ProtectedRoute from "@/react-app/components/ProtectedRoute";
import StartScreen from "@/react-app/pages/StartScreen";
import Game from "@/react-app/pages/Game";
import LevelSelectScreen from "@/react-app/pages/LevelSelectScreen";
import AuthPage from "@/react-app/pages/AuthPage";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          
          {/* Public routes - accessible without authentication */}
          <Route path="/" element={<StartScreen />} />
          
          {/* Protected routes - require authentication */}
          <Route 
            path="/game" 
            element={
              <ProtectedRoute>
                <Game />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/levels" 
            element={
              <ProtectedRoute>
                <LevelSelectScreen />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
