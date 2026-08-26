import { useEffect, useRef } from 'react';
import { hostRehydrateState, hostListenForIntents } from '../firebase/gameSync.js';
import { touchHostHeartbeat } from '../firebase/roomService.js';

/**
 * Runs ONLY on the host's device. Loads full authoritative state (including
 * hands + the real draw pile) from Firestore, then listens for player
 * intents and applies them via the tested gameEngine functions. Also sends
 * a periodic heartbeat so other clients can detect if this host disappears
 * (see useHostWatchdog.js for the reclaim side).
 */
export function useHostEngine(roomCode, gameNumber, playerIds, isHost) {
  const stateRef = useRef(null);

  useEffect(() => {
    if (!isHost || !roomCode || !gameNumber || playerIds.length === 0) return undefined;
    let unsub;
    let cancelled = false;

    (async () => {
      const state = await hostRehydrateState(roomCode, gameNumber, playerIds);
      if (cancelled) return;
      stateRef.current = state;
      unsub = hostListenForIntents(
        roomCode,
        gameNumber,
        () => stateRef.current,
        (newState) => {
          stateRef.current = newState;
        }
      );
    })();

    const heartbeat = setInterval(() => {
      touchHostHeartbeat(roomCode).catch(() => {
        /* fine to miss an occasional beat; a slow network hiccup shouldn't
           trigger a takeover, only a genuinely absent host should */
      });
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roomCode, gameNumber, playerIds.join(',')]);
}
