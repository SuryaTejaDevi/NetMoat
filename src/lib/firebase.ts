import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVNdf8oizhJSNB3oFv5rF_UktNl4JhzYQ",
  authDomain: "netmoat.firebaseapp.com",
  projectId: "netmoat",
  storageBucket: "netmoat.firebasestorage.app",
  messagingSenderId: "172884593732",
  appId: "1:172884593732:web:391d76c0677d6e3ca58011",
  measurementId: "G-4B6D3JQ323"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
