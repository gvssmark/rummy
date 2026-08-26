// deck.js
// Card & deck model for 13-card Rummy.
// Uses 2 standard decks + 2 printed jokers per deck (108 cards total),
// which is standard regardless of player count (2-6 players).

export const SUITS = ['S', 'H', 'D', 'C']; // Spades, Hearts, Diamonds, Clubs
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Rank order used for sequence adjacency checks (A is low only, per house rule A=10 pts
// but for sequence purposes A only connects to 2-3-4..., not K-A-2, unless you want that -
// configurable via ACE_HIGH_AND_LOW below).
const RANK_ORDER = RANKS.reduce((acc, r, i) => {
  acc[r] = i;
  return acc;
}, {});

// Point value of a rank when NOT acting as a joker (house rule: Ace = 10).
export function rankPointValue(rank) {
  if (rank === 'A') return 10;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return parseInt(rank, 10); // '2'..'10'
}

let _cardCounter = 0;
function nextId() {
  _cardCounter += 1;
  return _cardCounter;
}

/**
 * Build a fresh shoe: 2 decks x 52 cards + 2 printed jokers per deck = 108 cards.
 * Each card: { id, deckNum, suit, rank, isPrintedJoker }
 */
export function createShoe() {
  _cardCounter = 0;
  const cards = [];
  for (let deckNum = 1; deckNum <= 2; deckNum++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `d${deckNum}-${suit}${rank}-${nextId()}`,
          deckNum,
          suit,
          rank,
          isPrintedJoker: false,
        });
      }
    }
    // 2 printed jokers per physical deck
    for (let j = 0; j < 2; j++) {
      cards.push({
        id: `d${deckNum}-PJ-${nextId()}`,
        deckNum,
        suit: null,
        rank: null,
        isPrintedJoker: true,
      });
    }
  }
  return cards;
}

/**
 * Fisher-Yates shuffle. Accepts an injectable RNG for deterministic tests;
 * defaults to Math.random for real games.
 */
export function shuffle(cards, rng = Math.random) {
  const arr = cards.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function rankIndex(rank) {
  return RANK_ORDER[rank];
}

export function cardLabel(card) {
  if (card.isPrintedJoker) return 'JOKER';
  return `${card.rank}${card.suit}`;
}
