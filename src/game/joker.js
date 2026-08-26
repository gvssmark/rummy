// joker.js
// Configurable joker system:
//  - Printed joker cards are ALWAYS wild, in every game (standard practice).
//  - In "cut" mode, one extra card is drawn face-up after the deal; its RANK
//    becomes an additional wildcard rank in all suits, for that game only.
//  - In "printed" mode, there is no cut card - only the printed joker cards are wild.
//
// Per-room config decides which games in a round use which mode. Default:
// game 1 and the last game of the round = 'printed', everything in between = 'cut'.

export const JOKER_MODES = {
  PRINTED: 'printed',
  CUT: 'cut',
};

/**
 * Decide joker mode for a given game number within a round.
 * @param {number} gameNumber - 1-indexed game number within the round
 * @param {number} totalGamesInRound - total planned games in the round (if known; can be undefined for open-ended rounds played to a target score)
 * @param {object} config - room-level override, e.g. { firstGame: 'printed', lastGame: 'printed', middle: 'cut' }
 */
export function resolveJokerMode(gameNumber, totalGamesInRound, config = {}) {
  const cfg = {
    firstGame: 'printed',
    lastGame: 'printed',
    middle: 'cut',
    ...config,
  };
  if (gameNumber === 1) return cfg.firstGame;
  if (totalGamesInRound && gameNumber === totalGamesInRound) return cfg.lastGame;
  return cfg.middle;
}

/**
 * Draw the cut joker card from the remaining shoe (after dealing hands).
 * Returns { cutCard, cutRank, remainingShoe }.
 * If the drawn card is itself a printed joker, standard practice is to
 * redraw (a printed joker can't also be the cut-rank indicator).
 */
export function drawCutJoker(shoeAfterDeal) {
  const shoe = shoeAfterDeal.slice();
  let cutCard = shoe.shift();
  while (cutCard && cutCard.isPrintedJoker && shoe.length > 0) {
    // put it back near the bottom and try again
    shoe.push(cutCard);
    cutCard = shoe.shift();
  }
  return {
    cutCard,
    cutRank: cutCard ? cutCard.rank : null,
    remainingShoe: shoe,
  };
}

/**
 * A joker context bundles everything needed to know if a card is wild
 * for the CURRENT game.
 * @param {'printed'|'cut'} mode
 * @param {string|null} cutRank - only relevant when mode === 'cut'
 */
export function makeJokerContext(mode, cutRank = null) {
  return {
    mode,
    cutRank: mode === JOKER_MODES.CUT ? cutRank : null,
  };
}

/** Is this card wild in the current game? */
export function isWild(card, jokerContext) {
  if (card.isPrintedJoker) return true;
  if (jokerContext.mode === JOKER_MODES.CUT && jokerContext.cutRank) {
    return card.rank === jokerContext.cutRank;
  }
  return false;
}
