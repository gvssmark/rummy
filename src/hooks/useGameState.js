import { useEffect, useState } from 'react';
import { listenToPublicGameState, listenToMyHand } from '../firebase/gameSync.js';

export function useGameState(roomCode, gameNumber, uid) {
  const [publicState, setPublicState] = useState(undefined);
  const [myHand, setMyHand] = useState([]);

  useEffect(() => {
    if (!roomCode || !gameNumber) return undefined;
    const unsub1 = listenToPublicGameState(roomCode, gameNumber, setPublicState);
    const unsub2 = listenToMyHand(roomCode, gameNumber, uid, setMyHand);
    return () => {
      unsub1();
      unsub2();
    };
  }, [roomCode, gameNumber, uid]);

  return { publicState, myHand };
}
