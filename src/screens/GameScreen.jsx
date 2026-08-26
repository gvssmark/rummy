import { useState } from 'react';
import Card from '../components/Card.jsx';
import DeclareModal from '../components/DeclareModal.jsx';
import { useGameState } from '../hooks/useGameState.js';
import { useHostEngine } from '../hooks/useHostEngine.js';
import { useHostWatchdog } from '../hooks/useHostWatchdog.js';
import { intents, hostDealAndPublishGame } from '../firebase/gameSync.js';
import { updateRunningScores, advanceToGameNumber, markRoundOver } from '../firebase/roomService.js';
import { playersOverTarget } from '../game/scoring.js';
import { isWild } from '../game/joker.js';
import { sortHandForDisplay } from '../utils/handSort.js';

export default function GameScreen({ user, room, players, roomCode }) {
  const gameNumber = room.currentGameNumber;
  const isHost = room.hostUid === user.uid;
  const playerIds = room.seating || players.map((p) => p.uid);

  useHostEngine(roomCode, gameNumber, playerIds, isHost);
  useHostWatchdog(roomCode, room, user, isHost);
  const { publicState, myHand } = useGameState(roomCode, gameNumber, user.uid);
  const sortedHand = sortHandForDisplay(myHand);

  const [declaring, setDeclaring] = useState(false);
  const [actionError, setActionError] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [confirmingDrop, setConfirmingDrop] = useState(false);

  if (!publicState) {
    return <div className="screen"><p className="muted">Loading table…</p></div>;
  }

  const jokerContext = publicState.jokerContext;
  const myTurn = publicState.turnOrder[publicState.currentTurnIndex] === user.uid;
  const iAmDropped = !!publicState.droppedPlayers?.[user.uid];
  const canAct = myTurn && !iAmDropped && publicState.status === 'inProgress';
  const topDiscard = publicState.discardPile[publicState.discardPile.length - 1];
  const inDiscardPhase = canAct && publicState.turnPhase === 'awaitingDiscardOrDeclare';

  const playerName = (uid) => players.find((p) => p.uid === uid)?.displayName || uid;

  async function act(fn) {
    setActionError('');
    try {
      await fn();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleAdvance() {
    setAdvancing(true);
    try {
      const deltas = publicState.finishedOutcomes.deltas;
      const newScores = { ...room.runningScores };
      for (const [uid, delta] of Object.entries(deltas)) {
        newScores[uid] = (newScores[uid] || 0) + delta;
      }
      await updateRunningScores(roomCode, newScores);

      const over = playersOverTarget(newScores, room.targetScore);
      if (over.length > 0) {
        await markRoundOver(roomCode);
      } else {
        const nextGameNumber = gameNumber + 1;
        await advanceToGameNumber(roomCode, nextGameNumber);
        await hostDealAndPublishGame(roomCode, nextGameNumber, playerIds, room.totalGamesInRound, room.jokerConfig);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAdvancing(false);
    }
  }

  if (publicState.status === 'finished') {
    return (
      <div className="screen">
        <div className="stack" style={{ marginTop: 24 }}>
          <div className="eyebrow">Game {gameNumber} result</div>
          <div className="ticket">
            <h2 style={{ color: 'var(--felt-900)', textAlign: 'center', fontSize: '1.3rem' }}>
              {publicState.winnerId ? `${playerName(publicState.winnerId)} wins!` : 'Wrong show — no winner'}
            </h2>
            <hr className="ticket-perforation" />
            <div className="stack" style={{ gap: 6 }}>
              {Object.entries(publicState.finishedOutcomes.deltas).map(([uid, delta]) => (
                <div key={uid} className="row between" style={{ fontSize: '0.9rem' }}>
                  <span>{playerName(uid)}</span>
                  <span>+{delta}</span>
                </div>
              ))}
            </div>
            {publicState.finishedOutcomes.declareReasons?.length > 0 && (
              <>
                <hr className="ticket-perforation" />
                <ul style={{ fontSize: '0.78rem', margin: 0, paddingLeft: 16 }}>
                  {publicState.finishedOutcomes.declareReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            )}
          </div>
          {isHost ? (
            <button className="primary" onClick={handleAdvance} disabled={advancing}>
              {advancing ? 'Dealing…' : 'Deal next game'}
            </button>
          ) : (
            <p className="muted">Waiting for the host to deal the next game…</p>
          )}
          {actionError && <p className="error-text">{actionError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ maxWidth: 520 }}>
      <div className="stack" style={{ width: '100%' }}>
        <div className="row between">
          <div className="eyebrow">
            Game {gameNumber} · {publicState.jokerMode === 'cut' ? `Cut joker: ${publicState.jokerContext.cutRank}` : 'Printed joker'}
          </div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>Target {room.targetScore}</div>
        </div>

        <div className="panel stack" style={{ gap: 6 }}>
          {playerIds.filter((id) => id !== user.uid).map((uid) => (
            <div key={uid} className="row between" style={{ fontSize: '0.85rem' }}>
              <span>
                {playerName(uid)}
                {publicState.turnOrder[publicState.currentTurnIndex] === uid && ' ← turn'}
              </span>
              <span className="muted">
                {publicState.droppedPlayers?.[uid] ? `dropped (${publicState.droppedPlayers[uid]})` : `${room.runningScores?.[uid] || 0} pts`}
              </span>
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 24, margin: '12px 0' }}>
          <div className="stack" style={{ alignItems: 'center', gap: 4, width: 'auto' }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Draw pile ({publicState.drawPileCount})</span>
            <Card
              faceDown
              onClick={canAct && publicState.turnPhase === 'awaitingDraw' ? () => act(() => intents.draw(roomCode, gameNumber, user.uid, 'draw')) : undefined}
            />
          </div>
          <div className="stack" style={{ alignItems: 'center', gap: 4, width: 'auto' }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Discard</span>
            {topDiscard ? (
              <Card
                card={topDiscard}
                wild={isWild(topDiscard, jokerContext)}
                onClick={canAct && publicState.turnPhase === 'awaitingDraw' ? () => act(() => intents.draw(roomCode, gameNumber, user.uid, 'discard')) : undefined}
              />
            ) : <Card faceDown />}
          </div>
        </div>

        {actionError && <p className="error-text" style={{ textAlign: 'center' }}>{actionError}</p>}

        <div>
          <div className="muted" style={{ fontSize: '0.75rem', marginBottom: 6 }}>
            Your hand ({myHand.length}){inDiscardPhase && ' — tap a card to discard it'}
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {sortedHand.map((card) => (
              <Card
                key={card.id}
                card={card}
                wild={isWild(card, jokerContext)}
                onClick={inDiscardPhase ? () => act(() => intents.discard(roomCode, gameNumber, user.uid, card.id)) : undefined}
              />
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <button
            className="danger"
            disabled={!canAct || publicState.turnPhase !== 'awaitingDraw'}
            onClick={() => setConfirmingDrop(true)}
          >
            Drop
          </button>
          <button className="primary" disabled={!inDiscardPhase} onClick={() => setDeclaring(true)}>
            Declare
          </button>
        </div>
      </div>

      {confirmingDrop && (
        <div style={overlayStyle}>
          <div className="panel stack" style={{ maxWidth: 360 }}>
            <h3 style={{ fontSize: '1rem' }}>Drop this hand?</h3>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              {publicState.hasTakenTurn?.[user.uid]
                ? 'You already took a turn this game, so this counts as a middle drop — 40 points.'
                : "You haven't drawn yet this game, so this counts as a first drop — 20 points."}
            </p>
            <div className="row" style={{ gap: 10 }}>
              <button className="secondary" onClick={() => setConfirmingDrop(false)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  setConfirmingDrop(false);
                  act(() => intents.drop(roomCode, gameNumber, user.uid));
                }}
              >
                Confirm drop
              </button>
            </div>
          </div>
        </div>
      )}

      {declaring && (
        <DeclareModal
          hand={sortedHand}
          jokerContext={jokerContext}
          submitting={false}
          submitError={actionError}
          onCancel={() => setDeclaring(false)}
          onSubmit={(groups, finishCardId) =>
            act(async () => {
              await intents.declare(roomCode, gameNumber, user.uid, groups, finishCardId);
              setDeclaring(false);
            })
          }
        />
      )}
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: 12,
};
