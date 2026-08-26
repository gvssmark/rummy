// roomService.js
// Lobby / room lifecycle: create, join, listen. Starting the game itself
// (dealing the first hand) lives in gameSync.js since it overlaps with the
// host-authoritative game state machine.

import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebaseInit.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion when read aloud/typed

function generateRoomCode(length = 5) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Creates a new room, retrying on the rare chance of a code collision.
 * @param {string} hostUid
 * @param {string} hostEmail
 * @param {object} options - { targetScore, jokerConfig, totalGamesInRound, displayName }
 * @returns {Promise<string>} the room code
 */
export async function createRoom(hostUid, hostEmail, options) {
  const { targetScore = 200, jokerConfig = {}, totalGamesInRound = null, displayName } = options;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const roomRef = doc(db, 'rooms', code);
    const existing = await getDoc(roomRef);
    if (existing.exists()) continue; // collision, retry with a new code

    await setDoc(roomRef, {
      hostUid,
      hostEmail,
      createdAt: serverTimestamp(),
      hostHeartbeatAt: serverTimestamp(),
      status: 'lobby',
      targetScore,
      jokerConfig: {
        firstGame: 'printed',
        lastGame: 'printed',
        middle: 'cut',
        ...jokerConfig,
      },
      totalGamesInRound,
      currentGameNumber: 0,
      seating: [],
      runningScores: {},
    });

    // Host automatically joins as the first player.
    await setDoc(doc(db, 'rooms', code, 'players', hostUid), {
      email: hostEmail,
      displayName: displayName || hostEmail,
      joinedAt: serverTimestamp(),
      connected: true,
    });

    return code;
  }
  throw new Error('Could not generate a unique room code, please try again.');
}

/**
 * @param {string} roomCode
 * @param {string} uid
 * @param {string} email
 * @param {string} displayName
 */
export async function joinRoom(roomCode, uid, email, displayName) {
  const roomRef = doc(db, 'rooms', roomCode.toUpperCase());
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Room not found. Check the code with the host.');
  const room = roomSnap.data();
  if (room.status !== 'lobby') throw new Error('This game has already started.');

  await setDoc(doc(db, 'rooms', roomCode.toUpperCase(), 'players', uid), {
    email,
    displayName: displayName || email,
    joinedAt: serverTimestamp(),
    connected: true,
  });

  return roomCode.toUpperCase();
}

export function listenToRoom(roomCode, callback) {
  return onSnapshot(doc(db, 'rooms', roomCode), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function listenToPlayers(roomCode, callback) {
  return onSnapshot(collection(db, 'rooms', roomCode, 'players'), (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  });
}

/** Host-only: lock in seating order and mark the room as in-game (dealing happens in gameSync.js). */
export async function markRoomInGame(roomCode, seating) {
  await updateDoc(doc(db, 'rooms', roomCode), {
    status: 'inGame',
    seating,
    currentGameNumber: 1,
  });
}

export async function updateRunningScores(roomCode, runningScores) {
  await updateDoc(doc(db, 'rooms', roomCode), { runningScores });
}

export async function advanceToGameNumber(roomCode, gameNumber) {
  await updateDoc(doc(db, 'rooms', roomCode), { currentGameNumber: gameNumber });
}

export async function markRoundOver(roomCode) {
  await updateDoc(doc(db, 'rooms', roomCode), { status: 'roundOver' });
}

/** Host action: called periodically (~every 10s) while the host's tab is active and processing intents. */
export async function touchHostHeartbeat(roomCode) {
  await updateDoc(doc(db, 'rooms', roomCode), { hostHeartbeatAt: serverTimestamp() });
}

/**
 * Any connected player may call this to take over as host if the current
 * host's heartbeat has gone stale (see firestore.rules for the staleness
 * check enforced server-side — this call simply fails harmlessly if the
 * heartbeat isn't actually stale yet, or if someone else already claimed it).
 */
export async function reclaimHost(roomCode, newHostUid) {
  await updateDoc(doc(db, 'rooms', roomCode), {
    hostUid: newHostUid,
    hostHeartbeatAt: serverTimestamp(),
  });
}

/** Host action: reuse the same room/code for a fresh round (reset scores). */
export async function startNewRound(roomCode) {
  await updateDoc(doc(db, 'rooms', roomCode), {
    status: 'lobby',
    runningScores: {},
    currentGameNumber: 0,
    seating: [],
  });
}
