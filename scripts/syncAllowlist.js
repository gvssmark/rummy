// scripts/syncAllowlist.js
//
// Run this LOCALLY (never in the deployed app) whenever you edit
// src/config/allowedFamilyMembers.js, to push the current list into
// Firestore's /allowlist collection, which the security rules check.
//
// Setup (one-time):
//   1. Firebase Console -> Project Settings -> Service Accounts
//      -> "Generate new private key" -> save as scripts/serviceAccountKey.json
//      (this file is gitignored - never commit it)
//   2. npm install firebase-admin --save-dev
//   3. node scripts/syncAllowlist.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { ALLOWED_FAMILY_MEMBERS } from '../src/config/allowedFamilyMembers.js';

const serviceAccount = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  if (ALLOWED_FAMILY_MEMBERS.length === 0) {
    console.log('No family members listed in allowedFamilyMembers.js yet - nothing to sync.');
    return;
  }
  const batch = db.batch();
  for (const member of ALLOWED_FAMILY_MEMBERS) {
    const emailKey = member.email.trim().toLowerCase();
    batch.set(db.collection('allowlist').doc(emailKey), {
      displayName: member.displayName || member.email,
    });
  }
  await batch.commit();
  console.log(`Synced ${ALLOWED_FAMILY_MEMBERS.length} family member(s) to Firestore allowlist.`);
}

main().catch((err) => {
  console.error('Failed to sync allowlist:', err);
  process.exit(1);
});
