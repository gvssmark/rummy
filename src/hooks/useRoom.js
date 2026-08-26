import { useEffect, useState } from 'react';
import { listenToRoom, listenToPlayers } from '../firebase/roomService.js';

export function useRoom(roomCode) {
  const [room, setRoom] = useState(undefined); // undefined = loading, null = not found
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!roomCode) return undefined;
    const unsubRoom = listenToRoom(roomCode, setRoom);
    const unsubPlayers = listenToPlayers(roomCode, setPlayers);
    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomCode]);

  return { room, players };
}
