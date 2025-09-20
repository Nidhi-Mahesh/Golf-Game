// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDcLoKKdkNlo--jyynShEHQtosZoSkxg70",
  authDomain: "golf-game-dfbc2.firebaseapp.com",
  projectId: "golf-game-dfbc2",
  storageBucket: "golf-game-dfbc2.firebasestorage.app",
  messagingSenderId: "832671217316",
  appId: "1:832671217316:web:c9a607c01aeea1e3ead831",
  measurementId: "G-RQBYM9FZB8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };