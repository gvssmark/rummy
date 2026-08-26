import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useRoom } from './hooks/useRoom.js';
import LoginScreen from './screens/LoginScreen.jsx';
import CreateOrJoinScreen from './screens/CreateOrJoinScreen.jsx';
import WaitingRoomScreen from './screens/WaitingRoomScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import RoundOverScreen from './screens/RoundOverScreen.jsx';

const ROOM_CODE_KEY = 'rummy_current_room_code';

export default function App() {
  const user = useAuth();
  const [roomCode, setRoomCode] = useState(() => window.localStorage.getItem(ROOM_CODE_KEY) || null);
  const { room, players } = useRoom(roomCode);

  useEffect(() => {
    if (roomCode) window.localStorage.setItem(ROOM_CODE_KEY, roomCode);
    else window.localStorage.removeItem(ROOM_CODE_KEY);
  }, [roomCode]);

  if (user === undefined) {
    return <div className="screen"><p className="muted">Loading…</p></div>;
  }
  if (user === null) {
    return <LoginScreen />;
  }
  if (!roomCode) {
    return <CreateOrJoinScreen user={user} onRoomReady={setRoomCode} />;
  }
  if (room === undefined) {
    return <div className="screen"><p className="muted">Loading room…</p></div>;
  }
  if (room === null) {
    // Stale code (room deleted or typo'd through) — clear and let them retry.
    window.localStorage.removeItem(ROOM_CODE_KEY);
    setRoomCode(null);
    return null;
  }

  if (room.status === 'lobby') {
    return (
      <WaitingRoomScreen
        user={user}
        room={room}
        players={players}
        roomCode={roomCode}
        onGameStarted={() => {}}
      />
    );
  }
  if (room.status === 'inGame') {
    return <GameScreen user={user} room={room} players={players} roomCode={roomCode} />;
  }
  if (room.status === 'roundOver') {
    return <RoundOverScreen user={user} room={room} players={players} roomCode={roomCode} />;
  }
  return null;
}
