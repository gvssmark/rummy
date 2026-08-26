// gameSync.js
//
// HOST-SIDE functions actually run the game (deal, apply intents) using the
// pure functions from src/game/*.js, then publish results to Firestore.
// CLIENT-SIDE functions (every player, including the host's own UI) only
// ever read public state + their own hand, and write intents.

import {
  doc,
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  where,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebaseInit.js';
import { dealGame } from '../game/dealer.js';
import { drawCard, discardCard, dropPlayer, declare } from '../game/gameEngine.js';

function gameDocRef(roomCode, gameNumber) {
  return doc(db, 'rooms', roomCode, 'games', String(gameNumber));
}
function handDocRef(roomCode, gameNumber, uid) {
  return doc(db, 'rooms', roomCode, 'games', String(gameNumber), 'hands', uid);
}
function intentsCollectionRef(roomCode, gameNumber) {
  return collection(db, 'rooms', roomCode, 'games', String(gameNumber), 'intents');
}
// Host-only doc holding the closed draw pile's actual contents. Never read
// by non-host clients (security rules restrict it) — this exists purely so
// a host can reload their browser mid-game without losing the deck order.
function hostPrivateDocRef(roomCode, gameNumber) {
  return doc(db, 'rooms', roomCode, 'games', String(gameNumber), 'hostPrivate', 'state');
}

/** Strip the `hands` field out of engine state for the shared public doc. */
function toPublicDoc(state) {
  // Destructure out `hands` (private) and `drawPile` (host-private contents)
  // entirely, rather than setting them to undefined — Firestore's JS SDK
  // throws on undefined field values by default.
  const { hands, drawPile, ...publicFields } = state;
  return {
    ...publicFields,
    drawPileCount: drawPile.length,
  };
}

// ---------- HOST: deal & publish a new game ----------

/**
 * Host action: deal a fresh game and publish public state + each player's
 * private hand in one batch.
 */
export async function hostDealAndPublishGame(roomCode, gameNumber, playerIds, totalGamesInRound, jokerConfig) {
  const state = dealGame(playerIds, gameNumber, totalGamesInRound, jokerConfig);
  const batch = writeBatch(db);

  batch.set(gameDocRef(roomCode, gameNumber), {
    ...toPublicDoc(state),
    updatedAt: serverTimestamp(),
  });

  for (const uid of playerIds) {
    batch.set(handDocRef(roomCode, gameNumber, uid), { cards: state.hands[uid] });
  }

  batch.set(hostPrivateDocRef(roomCode, gameNumber), { drawPile: state.drawPile });

  await batch.commit();
  return state; // host keeps this in memory as its authoritative working copy
}

/**
 * Host action: reconstruct full authoritative state (including the real
 * draw pile and everyone's hands) from Firestore. Use this on host page
 * load / host-handoff, instead of trusting an in-memory copy that may no
 * longer exist.
 */
export async function hostRehydrateState(roomCode, gameNumber, playerIds) {
  const publicSnap = await getDoc(gameDocRef(roomCode, gameNumber));
  const hostPrivateSnap = await getDoc(hostPrivateDocRef(roomCode, gameNumber));
  if (!publicSnap.exists()) throw new Error('No game state found to rehydrate.');

  const hands = {};
  for (const uid of playerIds) {
    const handSnap = await getDoc(handDocRef(roomCode, gameNumber, uid));
    hands[uid] = handSnap.exists() ? handSnap.data().cards : [];
  }

  const publicData = publicSnap.data();
  return {
    ...publicData,
    hands,
    drawPile: hostPrivateSnap.exists() ? hostPrivateSnap.data().drawPile : [],
  };
}

// ---------- HOST: process incoming intents ----------

/**
 * Host action: listen for unprocessed intents and apply them via gameEngine.
 * `getLocalState`/`setLocalState` let the host keep an in-memory copy of the
 * full state (including hands) rather than re-reading Firestore every time.
 */
export function hostListenForIntents(roomCode, gameNumber, getLocalState, setLocalState) {
  const q = query(intentsCollectionRef(roomCode, gameNumber), where('processed', '==', false));
  return onSnapshot(q, async (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type !== 'added') continue;
      const intentDoc = change.doc;
      const intent = intentDoc.data();
      await hostApplyOneIntent(roomCode, gameNumber, getLocalState, setLocalState, intentDoc.id, intent);
    }
  });
}

async function hostApplyOneIntent(roomCode, gameNumber, getLocalState, setLocalState, intentId, intent) {
  const before = getLocalState();
  let after;
  let error = null;
  try {
    switch (intent.type) {
      case 'draw':
        after = drawCard(before, intent.uid, intent.payload.source);
        break;
      case 'discard':
        after = discardCard(before, intent.uid, intent.payload.cardId);
        break;
      case 'drop':
        after = dropPlayer(before, intent.uid);
        break;
      case 'declare':
        after = declare(before, intent.uid, intent.payload.groups, intent.payload.finishCardId);
        break;
      default:
        throw new Error(`Unknown intent type: ${intent.type}`);
    }
  } catch (e) {
    error = e.message;
    after = before; // no state change on a rejected/illegal intent
  }

  // Mark the intent processed (with the error, if any, so the acting
  // player's client can show it to them).
  await updateDoc(doc(db, 'rooms', roomCode, 'games', String(gameNumber), 'intents', intentId), {
    processed: true,
    error,
  });

  if (error) return; // nothing else to publish

  setLocalState(after);

  const batch = writeBatch(db);
  batch.set(gameDocRef(roomCode, gameNumber), { ...toPublicDoc(after), updatedAt: serverTimestamp() });

  // Only rewrite hands that actually changed (reference inequality is a
  // cheap and correct check since gameEngine.js always returns new arrays
  // for hands it touches, and reuses the same array reference otherwise).
  for (const uid of Object.keys(after.hands)) {
    if (after.hands[uid] !== before.hands[uid]) {
      batch.set(handDocRef(roomCode, gameNumber, uid), { cards: after.hands[uid] });
    }
  }
  if (after.drawPile !== before.drawPile) {
    batch.set(hostPrivateDocRef(roomCode, gameNumber), { drawPile: after.drawPile });
  }
  await batch.commit();
}

// ---------- EVERY CLIENT: send an intent ----------

export async function sendIntent(roomCode, gameNumber, uid, type, payload = {}) {
  await addDoc(intentsCollectionRef(roomCode, gameNumber), {
    uid,
    type,
    payload,
    createdAt: serverTimestamp(),
    processed: false,
    error: null,
  });
}

export const intents = {
  draw: (roomCode, gameNumber, uid, source) => sendIntent(roomCode, gameNumber, uid, 'draw', { source }),
  discard: (roomCode, gameNumber, uid, cardId) => sendIntent(roomCode, gameNumber, uid, 'discard', { cardId }),
  drop: (roomCode, gameNumber, uid) => sendIntent(roomCode, gameNumber, uid, 'drop', {}),
  declare: (roomCode, gameNumber, uid, groups, finishCardId) =>
    sendIntent(roomCode, gameNumber, uid, 'declare', { groups, finishCardId }),
};

// ---------- EVERY CLIENT: read state ----------

export function listenToPublicGameState(roomCode, gameNumber, callback) {
  return onSnapshot(gameDocRef(roomCode, gameNumber), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export function listenToMyHand(roomCode, gameNumber, uid, callback) {
  return onSnapshot(handDocRef(roomCode, gameNumber, uid), (snap) => {
    callback(snap.exists() ? snap.data().cards : []);
  });
}

/**
 * A client (or the host's own UI) waits for its intent to be processed so
 * it can show an error if the move was rejected. Simple polling via
 * onSnapshot on the specific intent doc.
 */
export function waitForIntentResult(roomCode, gameNumber, intentId, callback) {
  return onSnapshot(doc(db, 'rooms', roomCode, 'games', String(gameNumber), 'intents', intentId), (snap) => {
    if (snap.exists() && snap.data().processed) {
      callback(snap.data().error || null);
    }
  });
}
