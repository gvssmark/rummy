import { useState } from 'react';
import { startNewRound } from '../firebase/roomService.js';

export default function RoundOverScreen({ user, room, players, roomCode }) {
  const [restarting, setRestarting] = useState(false);
  const isHost = room.hostUid === user.uid;

  const standings = players
    .map((p) => ({ ...p, score: room.runningScores?.[p.uid] || 0 }))
    .sort((a, b) => a.score - b.score); // lowest score wins in points rummy

  async function handleRestart() {
    setRestarting(true);
    try {
      await startNewRound(roomCode);
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="screen">
      <div className="stack" style={{ marginTop: 32 }}>
        <div className="eyebrow">Round over — target {room.targetScore} reached</div>
        <div className="ticket">
          <h2 style={{ color: 'var(--felt-900)', textAlign: 'center', fontSize: '1.2rem' }}>Final standings</h2>
          <hr className="ticket-perforation" />
          <div className="stack" style={{ gap: 8 }}>
            {standings.map((p, i) => (
              <div key={p.uid} className="row between">
                <span>{i === 0 ? '🏆 ' : ''}{p.displayName}</span>
                <span>{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button className="primary" onClick={handleRestart} disabled={restarting}>
            {restarting ? 'Starting…' : 'Start a new round (same room)'}
          </button>
        ) : (
          <p className="muted">Waiting for the host to start a new round…</p>
        )}
      </div>
    </div>
  );
}
