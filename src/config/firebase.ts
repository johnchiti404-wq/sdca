import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAlumyyH_QKhS86Xnr70MbdseqfauELVBw",
  authDomain: "aletwende.firebaseapp.com",
  databaseURL: "https://aletwende-default-rtdb.firebaseio.com",
  projectId: "aletwende",
  storageBucket: "aletwende.firebasestorage.app",
  messagingSenderId: "142861545293",
  appId: "1:142861545293:web:68937455173fb34ce19104",
  measurementId: "G-VKEVKGT6QK"
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
