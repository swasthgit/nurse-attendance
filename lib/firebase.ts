import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBtYh_EzxCASqCpq8Ad2t1AzTzcZMuTKaU",
  authDomain: "nurses-attendance.firebaseapp.com",
  projectId: "nurses-attendance",
  storageBucket: "nurses-attendance.firebasestorage.app",
  messagingSenderId: "784322764602",
  appId: "1:784322764602:web:06f3482cf7ab5ec8e7fa03",
  measurementId: "G-MS37X6NPYB"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
