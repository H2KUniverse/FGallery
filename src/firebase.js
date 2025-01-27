import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";  // Import listAll
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDTyYkLqPkRKbuOh2pRD7KH0Z4qpYt2K_c",
  authDomain: "freja-galleri-billeder.firebaseapp.com",
  projectId: "freja-galleri-billeder",
  storageBucket: "freja-galleri-billeder.firebasestorage.app",
  messagingSenderId: "87751049511",
  appId: "1:87751049511:web:45ab6402da2a1c2aa62902",
  measurementId: "G-880FGFDZWF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

const storage = getStorage(app);
const db = getFirestore(app);

export { storage, db, uploadBytes, ref, getDownloadURL, collection, addDoc, auth, signInAnonymously, listAll }; // Export listAll
