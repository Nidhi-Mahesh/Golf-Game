# Golf Game - Firebase Setup

This document explains the Firebase authentication and database integration for the Golf Game.

## Features Added

### 🔐 Authentication System
- **User Registration**: Create accounts with email and password
- **User Login**: Sign in with existing credentials  
- **User Profiles**: Store user information in Firestore
- **Protected Routes**: Game and levels require authentication
- **Auto-logout**: Session management handled automatically

### 🗄️ Database Integration
- **Firestore Database**: Cloud-based NoSQL database
- **User Profiles**: Store user stats and progress
- **Leaderboard**: Cloud-synchronized scores across devices
- **Offline Fallback**: localStorage backup when offline

### 📊 Leaderboard Features
- **Global Rankings**: Overall leaderboard across all levels
- **Per-Level Rankings**: Individual level leaderboards
- **Real-time Sync**: Scores sync across all devices
- **User Statistics**: Games played, levels completed, average strokes

## File Structure

```
src/
├── react-app/
│   ├── services/
│   │   ├── firebase.ts          # Firebase configuration
│   │   ├── auth.ts              # Authentication service
│   │   └── leaderboard.ts       # Leaderboard service (updated)
│   ├── contexts/
│   │   └── AuthContext.tsx      # React authentication context
│   ├── pages/
│   │   └── AuthPage.tsx         # Login/signup page
│   ├── components/
│   │   ├── ProtectedRoute.tsx   # Route protection wrapper
│   │   ├── UserProfile.tsx      # User profile component
│   │   └── Leaderboard.tsx      # Updated leaderboard component
│   └── App.tsx                  # Updated with auth routes
└── firestore.rules              # Firestore security rules
```

## Setup Instructions

### 1. Firebase Configuration
The Firebase project is already configured with:
- Project ID: `golf-game-dfbc2`
- Authentication enabled (Email/Password)
- Firestore database initialized

### 2. Database Collections

#### Users Collection (`/users/{uid}`)
- Stores user profiles and game statistics
- Fields: `displayName`, `email`, `gamesPlayed`, `totalStrokes`, `levelsCompleted`

#### Leaderboard Collection (`/leaderboard/{scoreId}`)
- Stores game scores and results
- Fields: `playerName`, `level`, `strokes`, `timestamp`, `userId`

### 3. Security Rules
The `firestore.rules` file contains security rules:
- Users can only access their own profiles
- Leaderboard is readable by everyone, writable by authenticated users
- Score validation ensures data integrity

## Usage

### Authentication Flow
1. **Access Protected Route** → Redirected to login page
2. **Sign Up/Login** → Create account or authenticate
3. **Auto-redirect** → Return to intended page
4. **Game Access** → Full access to game and leaderboard

### API Changes

#### LeaderboardService
All methods are now async and use Firestore:
- `addScore()` → `addScore(playerName, level, strokes, userId?)`
- `getTopScoresForLevel()` → Returns Promise
- `getOverallLeaderboard()` → Returns Promise
- Fallback to localStorage when offline

#### AuthService
New authentication methods:
- `signUpUser(email, password, displayName)`
- `signInUser(email, password)`
- `signOutUser()`
- `getUserProfile(uid)`
- `updateUserStats(uid, stats)`

## Routes

- `/` - Public start screen
- `/auth` - Login/signup page
- `/login` - Direct login page
- `/signup` - Direct signup page
- `/game` - Protected game route
- `/levels` - Protected level selection

## Components Usage

### AuthContext
```tsx
import { useAuth } from '@/contexts/AuthContext';

const { user, userProfile, loading, signOut } = useAuth();
```

### UserProfile Component
```tsx
import UserProfile from '@/components/UserProfile';

<UserProfile showSignOutButton={true} />
```

### ProtectedRoute
```tsx
import ProtectedRoute from '@/components/ProtectedRoute';

<ProtectedRoute>
  <YourProtectedComponent />
</ProtectedRoute>
```

## Development

To run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5174/`

## Firebase Console

Access the Firebase console at: https://console.firebase.google.com/
Project ID: `golf-game-dfbc2`

From there you can:
- View user accounts in Authentication
- Browse database collections in Firestore
- Update security rules
- Monitor usage and errors