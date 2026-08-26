import { useEffect, useRef } from 'react';
import { reclaimHost } from '../firebase/roomService.js';

const STALE_MS = 30000;

/**
 * Runs on every non-host client during active play. If the current host's
 * heartbeat goes stale (host's tab closed, phone locked with the browser
 * killed, lost connection), this attempts to take over as host. A random
 * jitter reduces (but doesn't eliminate) the chance of two players racing
 * to reclaim at once — Firestore just accepts whichever write lands first,
 * which is an acceptable outcome for a casual family game.
 */
export function useHostWatchdog(roomCode, room, user, isHost) {
  const attemptingRef = useRef(false);

  useEffect(() => {
    if (isHost || !room || room.status !== 'inGame') return undefined;

    const check = setInterval(() => {
      if (attemptingRef.current) return;
      const heartbeat = room.hostHeartbeatAt;
      if (!heartbeat || typeof heartbeat.toMillis !== 'function') return;

      const age = Date.now() - heartbeat.toMillis();
      if (age <= STALE_MS) return;

      attemptingRef.current = true;
      const jitter = Math.random() * 3000;
      setTimeout(() => {
        reclaimHost(roomCode, user.uid)
          .catch(() => {
            /* someone else likely claimed it first, or it wasn't actually
               stale by the time this landed — either way, no action needed */
          })
          .finally(() => {
            attemptingRef.current = false;
          });
      }, jitter);
    }, 5000);

    return () => clearInterval(check);
  }, [roomCode, room, user, isHost]);
}
