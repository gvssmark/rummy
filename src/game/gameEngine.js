// gameEngine.js
// Pure state-transition functions for a single game (one hand of play).
// Designed to run on the HOST's device: the host applies these to its local
// state and writes the result to Firestore; other clients only ever send
// "intents" (draw/discard/drop/declare requests) for the host to apply.
//
// Every function either returns a new state object or throws an Error with
// a human-readable message (safe to show to the acting player).

import { validateDeclaration } from './meldValidator.js';
import { scoreHand } from './scoring.js';
import { shuffle } from './deck.js';

function currentPlayer(state) {
  return state.turnOrder[state.currentTurnIndex];
}

function activePlayers(state) {
  return state.turnOrder.filter((id) => !state.droppedPlayers[id]);
}

function assertPlayersTurn(state, playerId) {
  if (state.status !== 'inProgress') throw new Error('This game has already finished.');
  if (currentPlayer(state) !== playerId) throw new Error('It is not your turn.');
}

function advanceTurn(state) {
  const order = state.turnOrder;
  let idx = state.currentTurnIndex;
  const active = activePlayers(state);
  if (active.length <= 1) {
    // Only one player left standing -> they win by default.
    return { ...state, status: 'finished', winnerId: active[0] || null };
  }
  do {
    idx = (idx + 1) % order.length;
  } while (state.droppedPlayers[order[idx]]);
  return { ...state, currentTurnIndex: idx };
}

/** Reshuffle discard pile (except the top card) into a fresh draw pile if it runs out. */
function ensureDrawPileHasCards(state, rng = Math.random) {
  if (state.drawPile.length > 0) return state;
  if (state.discardPile.length <= 1) {
    // Extremely rare edge case: nothing left to reshuffle. Caller should handle.
    return state;
  }
  const top = state.discardPile[state.discardPile.length - 1];
  const rest = state.discardPile.slice(0, -1);
  const newDrawPile = shuffle(rest, rng);
  return { ...state, drawPile: newDrawPile, discardPile: [top] };
}

/**
 * Draw a card from either the closed draw pile or the open discard pile.
 * @param {'draw'|'discard'} source
 */
export function drawCard(state, playerId, source, rng = Math.random) {
  assertPlayersTurn(state, playerId);
  if (state.turnPhase !== 'awaitingDraw') {
    throw new Error('You already drew this turn — discard or declare next.');
  }
  if (source !== 'draw' && source !== 'discard') {
    throw new Error('Invalid draw source.');
  }

  let working = ensureDrawPileHasCards(state, rng);

  let drawnCard;
  if (source === 'draw') {
    if (working.drawPile.length === 0) {
      throw new Error('No cards left to draw and nothing to reshuffle.');
    }
    drawnCard = working.drawPile[working.drawPile.length - 1];
    working = { ...working, drawPile: working.drawPile.slice(0, -1) };
  } else {
    if (working.discardPile.length === 0) {
      throw new Error('Discard pile is empty.');
    }
    drawnCard = working.discardPile[working.discardPile.length - 1];
    working = { ...working, discardPile: working.discardPile.slice(0, -1) };
  }

  const newHands = { ...working.hands, [playerId]: [...working.hands[playerId], drawnCard] };
  return {
    ...working,
    hands: newHands,
    turnPhase: 'awaitingDiscardOrDeclare',
    hasTakenTurn: { ...working.hasTakenTurn, [playerId]: true },
  };
}

/** Discard one of the 14 cards currently held, ending the turn. */
export function discardCard(state, playerId, cardId) {
  assertPlayersTurn(state, playerId);
  if (state.turnPhase !== 'awaitingDiscardOrDeclare') {
    throw new Error('You must draw before you can discard.');
  }
  const hand = state.hands[playerId];
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) throw new Error('That card is not in your hand.');

  const card = hand[idx];
  const newHand = [...hand.slice(0, idx), ...hand.slice(idx + 1)];
  const working = {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    discardPile: [...state.discardPile, card],
    turnPhase: 'awaitingDraw',
  };
  return advanceTurn(working);
}

/**
 * Drop out of the current game. Must be done at the start of your turn,
 * before drawing. Scored as 'first' drop if you've never taken a turn yet
 * this game, otherwise 'middle' drop.
 */
export function dropPlayer(state, playerId) {
  assertPlayersTurn(state, playerId);
  if (state.turnPhase !== 'awaitingDraw') {
    throw new Error('You can only drop before drawing on your turn.');
  }
  const dropType = state.hasTakenTurn[playerId] ? 'middle' : 'first';
  const working = {
    ...state,
    droppedPlayers: { ...state.droppedPlayers, [playerId]: dropType },
  };
  return advanceTurn(working);
}

/**
 * Attempt to declare (finish) with a proposed grouping of 13 of your 14 cards,
 * discarding the remaining 1 as the finishing card. The app validates the
 * grouping immediately — no separate challenge step.
 *
 * @param {Array<{type, cards}>} groups - must total 13 cards
 * @param {string} finishCardId - the 14th card, discarded as part of finishing
 */
export function declare(state, playerId, groups, finishCardId) {
  assertPlayersTurn(state, playerId);
  if (state.turnPhase !== 'awaitingDiscardOrDeclare') {
    throw new Error('You must draw before you can declare.');
  }
  const hand = state.hands[playerId];
  const finishIdx = hand.findIndex((c) => c.id === finishCardId);
  if (finishIdx === -1) throw new Error('Finishing card is not in your hand.');

  const remainingThirteen = [...hand.slice(0, finishIdx), ...hand.slice(finishIdx + 1)];
  const result = validateDeclaration(remainingThirteen, groups, state.jokerContext);

  if (result.valid) {
    // Winner! Score everyone else's current hand at showdown.
    const outcomes = {};
    for (const id of state.turnOrder) {
      if (id === playerId) {
        outcomes[id] = { type: 'winner' };
      } else if (state.droppedPlayers[id] === 'first') {
        outcomes[id] = { type: 'firstDrop' };
      } else if (state.droppedPlayers[id] === 'middle') {
        outcomes[id] = { type: 'middleDrop' };
      } else {
        outcomes[id] = { type: 'showdown', cards: state.hands[id] };
      }
    }
    const deltas = scoreHand(outcomes, state.jokerContext);
    return {
      ...state,
      status: 'finished',
      winnerId: playerId,
      finishedOutcomes: { outcomes, deltas, declareReasons: [] },
    };
  }

  // Invalid declare: wrong show. Declarer is penalized; the hand ends for
  // everyone (simplest, clearest rule for a casual family game — avoids
  // ambiguity about whether play continues without the failed declarer).
  const outcomes = {};
  for (const id of state.turnOrder) {
    if (id === playerId) {
      outcomes[id] = { type: 'wrongShow' };
    } else if (state.droppedPlayers[id] === 'first') {
      outcomes[id] = { type: 'firstDrop' };
    } else if (state.droppedPlayers[id] === 'middle') {
      outcomes[id] = { type: 'middleDrop' };
    } else {
      outcomes[id] = { type: 'showdown', cards: state.hands[id] };
    }
  }
  const deltas = scoreHand(outcomes, state.jokerContext);
  return {
    ...state,
    status: 'finished',
    winnerId: null,
    finishedOutcomes: { outcomes, deltas, declareReasons: result.reasons },
  };
}
