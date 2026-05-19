import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAb56o3J4e9QNA8A2g4xxhhoKGqelZjOUo",
  authDomain: "gokulhub.firebaseapp.com",
  projectId: "gokulhub",
  storageBucket: "gokulhub.firebasestorage.app",
  messagingSenderId:  "468865700340",
  appId: "1:468865700340:web:7c05a6861bc61de845a9a1",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);