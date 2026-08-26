// meldValidator.js
// Validates a player's declared grouping of their 13 cards against house rules:
//   - Exactly 1 PURE sequence (3-5 consecutive same-suit cards, NO joker/wild used)
//   - Exactly 1 sequence that MAY use a joker/wild to fill a gap (3-5 cards)
//   - Exactly 2 sets/triplets (3-4 same-rank, distinct-suit cards, wild allowed)
//   - All 13 of the player's cards accounted for, each exactly once.
//
// This is a pure-function module (no Firebase, no UI) so it can be unit tested
// in isolation before being wired into game state.

import { rankIndex, RANKS } from './deck.js';
import { isWild } from './joker.js';

const GROUP_TYPES = ['pureSequence', 'jokerSequence', 'set'];

function splitWild(cards, jokerContext) {
  const wild = [];
  const plain = [];
  for (const c of cards) {
    if (isWild(c, jokerContext)) wild.push(c);
    else plain.push(c);
  }
  return { wild, plain };
}

function hasDuplicateSuits(cards) {
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c.suit)) return true;
    seen.add(c.suit);
  }
  return false;
}

function hasDuplicateRanks(cards) {
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c.rank)) return true;
    seen.add(c.rank);
  }
  return false;
}

/**
 * Checks a group as a PURE sequence: no wilds/jokers at all, same suit,
 * consecutive ranks, length 3-5.
 */
export function isPureSequence(group) {
  if (group.length < 3 || group.length > 5) {
    return { valid: false, reason: `Pure sequence must be 3-5 cards (got ${group.length}).` };
  }
  if (group.some((c) => c.isPrintedJoker)) {
    return { valid: false, reason: 'Pure sequence cannot contain a joker card.' };
  }
  const suits = new Set(group.map((c) => c.suit));
  if (suits.size !== 1) {
    return { valid: false, reason: 'Pure sequence must all be the same suit.' };
  }
  if (hasDuplicateRanks(group)) {
    return { valid: false, reason: 'Pure sequence cannot repeat a rank.' };
  }
  const indices = group.map((c) => rankIndex(c.rank)).sort((a, b) => a - b);
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      return { valid: false, reason: 'Pure sequence must be consecutive ranks (no gaps, no joker fill).' };
    }
  }
  return { valid: true };
}

/**
 * Checks a group as a sequence that MAY include wild/joker cards to fill gaps.
 * Non-wild cards must share a suit, have no duplicate ranks, and fit within
 * some consecutive run of `group.length` ranks (no wrap-around past King or below Ace).
 */
export function isSequenceAllowingJokers(group, jokerContext) {
  if (group.length < 3 || group.length > 5) {
    return { valid: false, reason: `Sequence must be 3-5 cards (got ${group.length}).` };
  }
  const { wild, plain } = splitWild(group, jokerContext);

  if (plain.length === 0) {
    // All-wild sequence: trivially placeable somewhere in the rank range.
    return { valid: true };
  }

  const suits = new Set(plain.map((c) => c.suit));
  if (suits.size !== 1) {
    return { valid: false, reason: 'Sequence cards must all be the same suit (jokers excluded).' };
  }
  if (hasDuplicateRanks(plain)) {
    return { valid: false, reason: 'Sequence cannot repeat a rank among its non-joker cards.' };
  }

  const indices = plain.map((c) => rankIndex(c.rank)).sort((a, b) => a - b);
  const minIdx = indices[0];
  const maxIdx = indices[indices.length - 1];
  const span = maxIdx - minIdx + 1;
  const length = group.length;

  if (span > length) {
    return { valid: false, reason: 'Gaps between cards are too large to fill with the available jokers.' };
  }

  const lastValidStart = RANKS.length - length; // no wrap past King
  const startLow = Math.max(0, maxIdx - length + 1);
  const startHigh = Math.min(minIdx, lastValidStart);

  if (startLow > startHigh) {
    return { valid: false, reason: 'No valid consecutive-rank window fits these cards within the deck range.' };
  }

  return { valid: true };
}

/**
 * Checks a group as a set/triplet: same rank (non-wild cards), distinct suits,
 * length 3-4, wild cards allowed to fill remaining slots.
 */
export function isSet(group, jokerContext) {
  if (group.length < 3 || group.length > 4) {
    return { valid: false, reason: `Set must be 3-4 cards (got ${group.length}).` };
  }
  const { wild, plain } = splitWild(group, jokerContext);

  if (plain.length === 0) {
    return { valid: true }; // all-wild set, trivially fine
  }

  const ranks = new Set(plain.map((c) => c.rank));
  if (ranks.size !== 1) {
    return { valid: false, reason: 'All non-joker cards in a set must share the same rank.' };
  }
  if (hasDuplicateSuits(plain)) {
    return { valid: false, reason: 'A set cannot repeat the same suit (even from a second deck).' };
  }
  if (plain.length > 4) {
    return { valid: false, reason: 'A set cannot have more than 4 cards (one per suit).' };
  }
  return { valid: true };
}

/**
 * Validate a full 13-card declaration.
 * @param {Array} originalHand - the 13 cards actually in the player's hand
 * @param {Array<{type: 'pureSequence'|'jokerSequence'|'set', cards: Array}>} groups
 * @param {object} jokerContext - from joker.js makeJokerContext()
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export function validateDeclaration(originalHand, groups, jokerContext) {
  const reasons = [];

  // 1. Structure check: exactly 1 pureSequence, 1 jokerSequence, 2 sets.
  const counts = { pureSequence: 0, jokerSequence: 0, set: 0 };
  for (const g of groups) {
    if (!GROUP_TYPES.includes(g.type)) {
      reasons.push(`Unknown group type "${g.type}".`);
      continue;
    }
    counts[g.type] += 1;
  }
  if (counts.pureSequence !== 1) reasons.push(`Need exactly 1 pure sequence (found ${counts.pureSequence}).`);
  if (counts.jokerSequence !== 1) reasons.push(`Need exactly 1 sequence allowing a joker (found ${counts.jokerSequence}).`);
  if (counts.set !== 2) reasons.push(`Need exactly 2 sets (found ${counts.set}).`);

  // 2. Card accounting: every original card used exactly once, nothing extra.
  const originalIds = new Set(originalHand.map((c) => c.id));
  const usedIds = [];
  for (const g of groups) {
    for (const c of g.cards) usedIds.push(c.id);
  }
  const usedIdSet = new Set(usedIds);
  if (usedIds.length !== 13) {
    reasons.push(`Declaration must use exactly 13 cards (found ${usedIds.length}).`);
  }
  if (usedIds.length !== usedIdSet.size) {
    reasons.push('A card was used in more than one group.');
  }
  for (const id of usedIdSet) {
    if (!originalIds.has(id)) reasons.push('A declared card is not actually in the player\'s hand.');
  }
  for (const id of originalIds) {
    if (!usedIdSet.has(id)) reasons.push('Not all of the player\'s cards were placed in a group.');
  }

  // 3. Per-group validity (only if structure counts are sane enough to check).
  for (const g of groups) {
    let result;
    if (g.type === 'pureSequence') result = isPureSequence(g.cards);
    else if (g.type === 'jokerSequence') result = isSequenceAllowingJokers(g.cards, jokerContext);
    else if (g.type === 'set') result = isSet(g.cards, jokerContext);
    else continue;

    if (!result.valid) reasons.push(result.reason);
  }

  return { valid: reasons.length === 0, reasons };
}
