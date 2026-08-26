// handSort.js
// Purely presentational: orders a hand for display (jokers last, then by
// suit, then by rank) so cards belonging to the same potential meld sit
// near each other. Never mutates card identity or affects any game logic.

import { rankIndex } from '../game/deck.js';

const SUIT_ORDER = { S: 0, H: 1, D: 2, C: 3 };

export function sortHandForDisplay(cards) {
  return [...cards].sort((a, b) => {
    if (a.isPrintedJoker !== b.isPrintedJoker) return a.isPrintedJoker ? 1 : -1;
    if (a.isPrintedJoker) return 0;
    if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return rankIndex(a.rank) - rankIndex(b.rank);
  });
}
