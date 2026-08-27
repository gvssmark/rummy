import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCJvSgo2sC-zyFAFGYZ14SjLKcU2vJ7N_U',
  authDomain: 'family-rummy-6a641.firebaseapp.com',
  projectId: 'family-rummy-6a641',
  storageBucket: 'family-rummy-6a641.firebasestorage.app',
  messagingSenderId: '974097603735',
  appId: '1:974097603735:web:fbda71dae64b4396541dd2',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);