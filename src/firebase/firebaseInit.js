// firebaseInit.js
//
// Fill in the config object below with values from your Firebase project
// (Project settings -> General -> Your apps -> SDK setup and configuration).
// This is safe to commit to a public GitHub repo — Firebase web config
// values are not secret; access is controlled by Firestore security rules
// and the email allow-list, not by hiding this config.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
