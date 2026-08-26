# Host handoff (implemented)

The host's browser tab is the single authoritative game engine for a room.
If the host's phone locks, loses signal, or closes the tab mid-game, play
needs to recover without losing state (everything is already durably
stored in Firestore — only the *processing* of new intents stops).

**How it works (implemented in `useHostEngine.js` + `useHostWatchdog.js`):**
1. The host's client writes `hostHeartbeatAt: serverTimestamp()` to the
   room doc every 10 seconds while its tab is open and processing intents.
2. Every other client polls that timestamp every 5 seconds. If it's more
   than 30 seconds stale while the room is `inGame`, that client attempts
   to reclaim host duty by writing `hostUid: <their uid>` — a random 0-3s
   jitter is added before attempting, to reduce (not eliminate) the chance
   of two players racing to reclaim simultaneously.
3. This write is guarded by a Firestore rule (`firestore.rules`) that only
   allows it when the room is `inGame`, the stored heartbeat really is
   stale, and the write touches *only* `hostUid` + `hostHeartbeatAt` —
   so it can't be used to hijack an active game for any other purpose.
4. Once `hostUid` changes, the new host's `useHostEngine` picks it up
   automatically (its `isHost` check flips true) and calls
   `hostRehydrateState()` to reconstruct full state — including the real
   draw pile and everyone's hands — from Firestore, rather than trusting
   any in-memory copy that may no longer exist.

This is "good enough for a casual family game" resilience, not a
distributed-consensus system — an extremely unlucky double-disconnect in
the same few seconds could in theory abandon a hand, which is an
acceptable trade-off for a free, code-light family app.
