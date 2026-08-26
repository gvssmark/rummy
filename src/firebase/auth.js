// auth.js
// Passwordless email-link sign-in, restricted to the family allow-list.
// Flow:
//   1. User enters their email on the login screen.
//   2. We check it's in ALLOWED_FAMILY_MEMBERS before even sending a link
//      (fast, friendly rejection — Firestore rules are the real enforcement).
//   3. sendSignInLink() emails them a magic link.
//   4. They open it (same device or another), completeSignIn() finishes auth.

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { auth } from './firebaseInit.js';
import { ALLOWED_FAMILY_MEMBERS } from '../config/allowedFamilyMembers.js';

const EMAIL_STORAGE_KEY = 'rummy_pending_signin_email';

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email) {
  const normalized = normalizeEmail(email);
  return ALLOWED_FAMILY_MEMBERS.some((m) => normalizeEmail(m.email) === normalized);
}

/**
 * @param {string} email
 * @param {string} continueUrl - full URL back to the app (e.g. your GitHub Pages URL)
 */
export async function sendSignInLink(email, continueUrl) {
  const normalized = normalizeEmail(email);
  if (!isAllowedEmail(normalized)) {
    throw new Error('This email is not on the family list. Ask the host to add it.');
  }
  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, normalized, actionCodeSettings);
  window.localStorage.setItem(EMAIL_STORAGE_KEY, normalized);
}

/** Call this on app load to check if the current URL is a sign-in link. */
export function isSignInLink(url = window.location.href) {
  return isSignInWithEmailLink(auth, url);
}

/**
 * Completes sign-in from the link. If the link is opened on a different
 * device than it was requested from, we won't have the email in
 * localStorage — fall back to asking for it again.
 */
export async function completeSignIn(promptForEmail, url = window.location.href) {
  let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  if (!email) {
    email = normalizeEmail(await promptForEmail());
  }
  const result = await signInWithEmailLink(auth, email, url);
  window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  return result.user;
}

export function signOut() {
  return auth.signOut();
}
