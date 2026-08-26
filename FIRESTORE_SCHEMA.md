# Firestore data model

Goal: everyone in a room can see shared table state in real time, but
**no one can read another player's hand** — Firestore security rules
enforce that at the document level (rules can't filter individual
fields, so hands live in their own per-player documents).

## Collections

```
/allowlist/{emailAsDocId}          (see below)

/rooms/{roomCode}
    hostUid: string
    hostEmail: string
    createdAt: timestamp
    status: 'lobby' | 'inGame' | 'roundOver'
    targetScore: number
    jokerConfig: { firstGame: 'printed', lastGame: 'printed', middle: 'cut' }
    totalGamesInRound: number | null   // null = open-ended, play to targetScore
    currentGameNumber: number
    seating: string[]                  // uids, in turn order, fixed for the round
    runningScores: { [uid]: number }

  /rooms/{roomCode}/players/{uid}
      email: string
      displayName: string
      joinedAt: timestamp
      connected: boolean               // updated via onDisconnect / heartbeat
      lastSeenAt: timestamp

  /rooms/{roomCode}/games/{gameNumber}          <- PUBLIC per-game state
      jokerMode: 'printed' | 'cut'
      cutRank: string | null
      cutCard: Card | null             // the actual cut card, safe to show all (not part of anyone's hand)
      discardPile: Card[]              // full pile is fine to expose; it's public info in real rummy too
      drawPileCount: number            // COUNT only, not contents
      turnOrder: string[]
      currentTurnIndex: number
      turnPhase: 'awaitingDraw' | 'awaitingDiscardOrDeclare'
      droppedPlayers: { [uid]: 'first' | 'middle' }
      status: 'inProgress' | 'finished'
      winnerUid: string | null
      finishedOutcomes: {...} | null   // deltas + declare reasons, safe to show once finished

    /rooms/{roomCode}/games/{gameNumber}/hands/{uid}   <- PRIVATE, one doc per player
        cards: Card[]                  // only this player (and the host, for authority) may read

    /rooms/{roomCode}/games/{gameNumber}/intents/{autoId}   <- write-only queue
        uid: string
        type: 'draw' | 'discard' | 'drop' | 'declare'
        payload: {...}                 // e.g. { source: 'draw' } or { groups, finishCardId }
        createdAt: timestamp
        processed: boolean             // host flips this after applying
```

`Card` shape (matches `src/game/deck.js`): `{ id, deckNum, suit, rank, isPrintedJoker }`.

## Why "intents" instead of clients writing state directly

Every non-host client only ever WRITES an intent doc (its own move
request) and READS public state + its own hand. The **host's browser
tab** is the only writer of the public game doc and the hands
subcollection — it listens for new intents, runs them through the
already-tested pure functions in `src/game/gameEngine.js`, and writes
the resulting state back. This keeps all game rules in one
well-tested place instead of duplicating validation into security
rules (Firestore rules can't run our meld-validation logic anyway).

If the host disconnects, see `HOST_HANDOFF.md` for the reclaim flow
(a stale-host timeout lets another connected player's tab take over
as host — same code, just flips a role flag).

## Email allow-list

`/allowlist/{emailAsDocId}` — one doc per allowed family email
(lowercased, with `.` replaced since Firestore doc IDs can contain
dots actually — so plain lowercased email is fine as the doc ID).
Doc just needs to exist; content can be `{ displayName: 'Name' }`.
This is what the security rules check before allowing anyone to
create a player doc in a room. The actual list of emails is
maintained in `src/config/allowedFamilyMembers.js` (a plain JS
array you edit) and pushed into Firestore via a one-time setup
script — see `scripts/syncAllowlist.js`.
