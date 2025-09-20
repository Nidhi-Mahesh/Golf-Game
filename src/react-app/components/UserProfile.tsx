import React from 'react';
import { User, LogOut, Trophy, Target, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileProps {
  showSignOutButton?: boolean;
  className?: string;
}

export default function UserProfile({ showSignOutButton = false, className = '' }: UserProfileProps) {
  const { user, userProfile, signOut } = useAuth();

  if (!user || !userProfile) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={`bg-white/15 backdrop-blur-sm rounded-xl p-6 shadow-xl ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          {userProfile.photoURL ? (
            <img 
              src={userProfile.photoURL} 
              alt={userProfile.displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-6 h-6 text-white" />
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{userProfile.displayName}</h3>
          <p className="text-white/70 text-sm">{userProfile.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <div className="text-white font-semibold text-lg">{userProfile.levelsCompleted}</div>
          <div className="text-white/70 text-xs">Levels</div>
        </div>
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <Target className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <div className="text-white font-semibold text-lg">{userProfile.gamesPlayed}</div>
          <div className="text-white/70 text-xs">Games</div>
        </div>
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <Award className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <div className="text-white font-semibold text-lg">
            {userProfile.gamesPlayed > 0 ? Math.round(userProfile.totalStrokes / userProfile.gamesPlayed) : 0}
          </div>
          <div className="text-white/70 text-xs">Avg Strokes</div>
        </div>
      </div>

      <div className="text-center text-white/60 text-sm mb-4">
        Member since {userProfile.createdAt.toLocaleDateString()}
      </div>

      {showSignOutButton && (
        <button
          onClick={handleSignOut}
          className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-100 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      )}
    </div>
  );
}