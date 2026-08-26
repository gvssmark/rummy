import { useState } from 'react';
import { createRoom, joinRoom } from '../firebase/roomService.js';

export default function CreateOrJoinScreen({ user, onRoomReady }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [targetScore, setTargetScore] = useState(200);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const code = await createRoom(user.uid, user.email, {
        targetScore: Number(targetScore),
        displayName: user.email,
      });
      onRoomReady(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const code = await joinRoom(joinCode, user.uid, user.email, user.email);
      onRoomReady(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="stack" style={{ marginTop: 32 }}>
        <div className="eyebrow">Signed in as {user.email}</div>
        <h1>Start a game</h1>

        {mode === null && (
          <div className="stack">
            <button className="primary" onClick={() => setMode('create')}>Create a room</button>
            <button className="secondary" onClick={() => setMode('join')}>Join with a code</button>
          </div>
        )}

        {mode === 'create' && (
          <div className="panel stack">
            <label className="muted">Target score (game ends when someone reaches this)</label>
            <input
              type="number"
              min="50"
              step="10"
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
            />
            <p className="muted">
              Joker rule: first and last game of the round use a printed joker;
              games in between use a cut (wildcard) joker.
            </p>
            {error && <p className="error-text">{error}</p>}
            <button className="primary" onClick={handleCreate} disabled={busy}>
              {busy ? 'Creating…' : 'Create room'}
            </button>
            <button className="secondary" onClick={() => setMode(null)}>Back</button>
          </div>
        )}

        {mode === 'join' && (
          <form className="panel stack" onSubmit={handleJoin}>
            <label className="muted">Room code from your host</label>
            <input
              type="text"
              placeholder="ABCDE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Joining…' : 'Join room'}
            </button>
            <button type="button" className="secondary" onClick={() => setMode(null)}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
