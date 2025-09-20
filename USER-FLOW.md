# Golf Game - User Flow

## Updated Authentication Flow

### 🎯 **New Flow: Landing → Login → Level Selector**

```
Landing Page (/) 
    ↓
[Start Playing Button]
    ↓
Login/Signup Page (/auth)
    ↓
[After Authentication]
    ↓
Level Selector Page (/levels)
    ↓ 
[Select Level]
    ↓
Game Page (/game)
```

## Detailed Flow Steps

### 1. **Landing Page (`/`)**
- **Public Access**: No authentication required
- **Content**: Game overview, features, leaderboard
- **Actions**: 
  - **Not Logged In**: "Sign In to Play" button → redirects to `/auth`
  - **Logged In**: "Continue Playing" button → redirects to `/levels`
- **Welcome Message**: Shows personalized greeting for logged-in users

### 2. **Authentication Page (`/auth`)**
- **Public Access**: Available to everyone
- **Content**: Login/Signup forms with toggle
- **Actions**:
  - **Login**: Email + Password → redirects to `/levels`
  - **Signup**: Email + Password + Display Name → redirects to `/levels`
- **Error Handling**: Firebase auth errors with user-friendly messages

### 3. **Level Selector (`/levels`)**
- **Protected Route**: Requires authentication
- **Content**: Available levels, progress, stats
- **Actions**: Select level → redirects to `/game`
- **User Info**: Shows authenticated user profile

### 4. **Game Page (`/game`)**
- **Protected Route**: Requires authentication  
- **Content**: 3D golf gameplay
- **Actions**: Play game, submit scores to leaderboard

## Route Protection

### Public Routes
- `/` - Landing page
- `/auth` - Login/signup page
- `/login` - Direct login page
- `/signup` - Direct signup page

### Protected Routes (Require Authentication)
- `/levels` - Level selection
- `/game` - Game gameplay

## User States

### **Unauthenticated User**
1. Visits landing page (`/`)
2. Sees "Sign In to Play" button
3. Clicks button → redirected to `/auth`
4. Creates account or signs in
5. Automatically redirected to `/levels`

### **Authenticated User**
1. Visits landing page (`/`)
2. Sees "Welcome back, [Name]!" message
3. Sees "Continue Playing" button
4. Clicks button → directly to `/levels`
5. Can access all protected routes

### **Returning User (Already Authenticated)**
1. Authentication state persists across browser sessions
2. Automatically recognized as authenticated
3. Can directly access protected routes
4. No need to re-login unless session expires

## Authentication Features

### **User Registration**
- Email validation
- Password strength requirements (6+ characters)
- Display name required
- Creates user profile in Firestore
- Auto-login after successful registration

### **User Login** 
- Email/password authentication
- "Remember me" functionality through Firebase session
- Error handling for invalid credentials
- Updates last login timestamp

### **Session Management**
- Firebase handles session persistence
- Auto-logout on session expiration
- Real-time authentication state updates
- Secure token management

## Benefits of This Flow

✅ **Clear User Journey**: Landing → Auth → Game
✅ **Security**: Protected routes ensure only authenticated users can play
✅ **User Experience**: Personalized greetings and state-aware buttons  
✅ **Data Persistence**: User progress and scores saved to cloud
✅ **Cross-Device Sync**: Play on multiple devices with same account