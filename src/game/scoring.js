// scoring.js
// Points rummy scoring. Configurable penalties; sensible defaults below.
// House rule: Ace = 10 points (set in deck.js rankPointValue).

import { rankPointValue } from './deck.js';
import { isWild } from './joker.js';

export const DEFAULT_SCORING_CONFIG = {
  firstDropPoints: 20,
  middleDropPoints: 40,
  wrongShowPoints: 80, // penalty for a failed/invalid declare (challenge upheld)
  maxHandPoints: 80, // cap on points for a player who didn't declare
};

/**
 * Sum of point values for a hand at showdown, for a player who did NOT
 * validly declare. Wild/joker cards score 0. Capped at maxHandPoints.
 */
export function computeHandPoints(cards, jokerContext, config = DEFAULT_SCORING_CONFIG) {
  let total = 0;
  for (const c of cards) {
    if (isWild(c, jokerContext)) continue; // jokers score 0
    total += rankPointValue(c.rank);
  }
  return Math.min(total, config.maxHandPoints);
}

export function firstDropScore(config = DEFAULT_SCORING_CONFIG) {
  return config.firstDropPoints;
}

export function middleDropScore(config = DEFAULT_SCORING_CONFIG) {
  return config.middleDropPoints;
}

export function wrongShowScore(config = DEFAULT_SCORING_CONFIG) {
  return config.wrongShowPoints;
}

/**
 * Given all players' outcomes for a finished hand, compute each player's
 * score delta for that hand. `outcomes` is a map of playerId -> outcome:
 *   { type: 'winner' }
 *   { type: 'firstDrop' }
 *   { type: 'middleDrop' }
 *   { type: 'wrongShow' }
 *   { type: 'showdown', cards: [...] }  // lost, cards counted at showdown
 * `jokerContext` needed to score showdown hands correctly.
 */
export function scoreHand(outcomes, jokerContext, config = DEFAULT_SCORING_CONFIG) {
  const deltas = {};
  for (const [playerId, outcome] of Object.entries(outcomes)) {
    switch (outcome.type) {
      case 'winner':
        deltas[playerId] = 0;
        break;
      case 'firstDrop':
        deltas[playerId] = firstDropScore(config);
        break;
      case 'middleDrop':
        deltas[playerId] = middleDropScore(config);
        break;
      case 'wrongShow':
        deltas[playerId] = wrongShowScore(config);
        break;
      case 'showdown':
        deltas[playerId] = computeHandPoints(outcome.cards, jokerContext, config);
        break;
      default:
        throw new Error(`Unknown outcome type: ${outcome.type}`);
    }
  }
  return deltas;
}

/**
 * Running total check: has any player reached/crossed the round's target score?
 * Returns array of playerIds who have (there could be a tie).
 */
export function playersOverTarget(runningTotals, targetScore) {
  return Object.entries(runningTotals)
    .filter(([, total]) => total >= targetScore)
    .map(([playerId]) => playerId);
}
