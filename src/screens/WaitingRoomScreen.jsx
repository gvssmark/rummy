import { markRoomInGame } from '../firebase/roomService.js';
import { hostDealAndPublishGame } from '../firebase/gameSync.js';
import { useState } from 'react';

export default function WaitingRoomScreen({ user, room, players, roomCode, onGameStarted }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const isHost = room.hostUid === user.uid;
  const canStart = players.length >= 2 && players.length <= 6;

  async function handleStart() {
    setStarting(true);
    setError('');
    try {
      const seating = players.map((p) => p.uid);
      await markRoomInGame(roomCode, seating);
      const state = await hostDealAndPublishGame(roomCode, 1, seating, room.totalGamesInRound, room.jokerConfig);
      onGameStarted(state);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  }

  return (
    <div className="screen">
      <div className="stack" style={{ marginTop: 24 }}>
        <div className="eyebrow">Share this with the family on WhatsApp</div>

        <div className="ticket">
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textAlign: 'center' }}>
            ROOM CODE
          </div>
          <div className="ticket-code">{roomCode}</div>
          <hr className="ticket-perforation" />
          <div style={{ fontSize: '0.8rem', textAlign: 'center' }}>
            Target score: {room.targetScore} pts
          </div>
        </div>

        <div className="panel stack">
          <h3 style={{ fontSize: '1rem' }}>Players ({players.length}/6)</h3>
          <div className="stack" style={{ gap: 8 }}>
            {players.map((p) => (
              <div key={p.uid} className="row between">
                <span>{p.displayName}{p.uid === room.hostUid ? ' (host)' : ''}</span>
                <span className="muted">{p.uid === user.uid ? 'you' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <>
            {!canStart && <p className="muted">Need 2-6 players to start.</p>}
            {error && <p className="error-text">{error}</p>}
            <button className="primary" onClick={handleStart} disabled={!canStart || starting}>
              {starting ? 'Dealing…' : 'Start game'}
            </button>
          </>
        ) : (
          <p className="muted">Waiting for the host to start the game…</p>
        )}
      </div>
    </div>
  );
}
