// dealer.js
// Handles the one-time setup of a game: shuffle, deal 13 cards to each player,
// set aside the draw pile, flip a starting discard card, and resolve the
// joker (printed vs cut) for this game number.

import { createShoe, shuffle } from './deck.js';
import { resolveJokerMode, drawCutJoker, makeJokerContext, JOKER_MODES } from './joker.js';

const HAND_SIZE = 13;

/** Rotates whose turn starts each game, so the same player isn't always first. */
function rotateStartingPlayer(playerIds, gameNumber) {
  const offset = (gameNumber - 1) % playerIds.length;
  return [...playerIds.slice(offset), ...playerIds.slice(0, offset)];
}

/**
 * @param {string[]} playerIds - seating order (fixed for the round; who starts rotates by gameNumber)
 * @param {number} gameNumber - 1-indexed within the round
 * @param {number|undefined} totalGamesInRound
 * @param {object} jokerConfig - room override for resolveJokerMode, e.g. {firstGame, lastGame, middle}
 * @param {function} rng - injectable RNG for tests; defaults to Math.random
 */
export function dealGame(playerIds, gameNumber, totalGamesInRound, jokerConfig = {}, rng = Math.random) {
  if (playerIds.length < 2 || playerIds.length > 6) {
    throw new Error('Rummy requires 2-6 players.');
  }

  const rotatedOrder = rotateStartingPlayer(playerIds, gameNumber);

  const shoe = shuffle(createShoe(), rng);
  const hands = {};
  for (const id of rotatedOrder) hands[id] = [];

  let cursor = 0;
  for (let card = 0; card < HAND_SIZE; card++) {
    for (const id of rotatedOrder) {
      hands[id].push(shoe[cursor]);
      cursor += 1;
    }
  }

  let remaining = shoe.slice(cursor);
  const mode = resolveJokerMode(gameNumber, totalGamesInRound, jokerConfig);

  let jokerContext;
  let cutCard = null;
  if (mode === JOKER_MODES.CUT) {
    const drawn = drawCutJoker(remaining);
    cutCard = drawn.cutCard;
    remaining = drawn.remainingShoe;
    jokerContext = makeJokerContext(JOKER_MODES.CUT, drawn.cutRank);
  } else {
    jokerContext = makeJokerContext(JOKER_MODES.PRINTED);
  }

  // Flip the first card of what remains to start the discard pile.
  const discardPile = remaining.length > 0 ? [remaining[0]] : [];
  const drawPile = remaining.slice(1);

  return {
    gameNumber,
    jokerMode: mode,
    jokerContext,
    cutCard,
    hands,
    drawPile,
    discardPile,
    turnOrder: rotatedOrder,
    currentTurnIndex: 0,
    turnPhase: 'awaitingDraw', // 'awaitingDraw' | 'awaitingDiscardOrDeclare'
    hasTakenTurn: Object.fromEntries(rotatedOrder.map((id) => [id, false])),
    droppedPlayers: {}, // playerId -> 'first' | 'middle'
    status: 'inProgress', // 'inProgress' | 'finished'
    winnerId: null,
    finishedOutcomes: null, // set when status becomes 'finished'
  };
}
