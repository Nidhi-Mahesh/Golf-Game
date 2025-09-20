import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  lastLoginAt: Date;
  gamesPlayed: number;
  totalStrokes: number;
  levelsCompleted: number;
}

export class AuthService {
  static async signUpUser(email: string, password: string, displayName: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update the user's profile
      await updateProfile(user, {
        displayName: displayName,
      });

      // Create user profile in Firestore
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: displayName,
        photoURL: user.photoURL || undefined,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        gamesPlayed: 0,
        totalStrokes: 0,
        levelsCompleted: 0,
      };

      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      return user;
    } catch (error) {
      console.error('Error signing up user:', error);
      throw error;
    }
  }

  static async signInUser(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update last login time
      await updateDoc(doc(db, 'users', user.uid), {
        lastLoginAt: serverTimestamp(),
      });

      return user;
    } catch (error) {
      console.error('Error signing in user:', error);
      throw error;
    }
  }

  static async signOutUser(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out user:', error);
      throw error;
    }
  }

  static onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
          gamesPlayed: data.gamesPlayed || 0,
          totalStrokes: data.totalStrokes || 0,
          levelsCompleted: data.levelsCompleted || 0,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  static async updateUserStats(uid: string, stats: Partial<UserProfile>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...stats,
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user stats:', error);
      throw error;
    }
  }
}