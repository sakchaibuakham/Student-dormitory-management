import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyqZHUiTx7iAaj_OPIk6tN-xRqmDtbNkQ",
  authDomain: "student-dormitory-management.firebaseapp.com",
  projectId: "student-dormitory-management",
  storageBucket: "student-dormitory-management.appspot.com",
  messagingSenderId: "4973440860",
  appId: "1:4973440860:web:9728b0cc8f947e58fadb99",
  measurementId: "G-12NGV018D1"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);