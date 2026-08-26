import { createShoe, shuffle, rankPointValue } from './deck.js';
import { resolveJokerMode, makeJokerContext, drawCutJoker, isWild, JOKER_MODES } from './joker.js';
import { validateDeclaration } from './meldValidator.js';
import { computeHandPoints, scoreHand } from './scoring.js';

let pass = 0;
let fail = 0;
function check(label, condition) {
  if (condition) {
    pass += 1;
    console.log(`  OK  ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label}`);
  }
}

function card(rank, suit) {
  return { id: `${rank}${suit}-${Math.random()}`, deckNum: 1, suit, rank, isPrintedJoker: false };
}
function joker() {
  return { id: `PJ-${Math.random()}`, deckNum: 1, suit: null, rank: null, isPrintedJoker: true };
}

console.log('--- deck.js ---');
{
  const shoe = createShoe();
  check('shoe has 108 cards (2 decks + 4 printed jokers)', shoe.length === 108);
  const printedJokers = shoe.filter((c) => c.isPrintedJoker);
  check('shoe has 4 printed jokers', printedJokers.length === 4);
  const shuffled = shuffle(shoe);
  check('shuffle preserves count', shuffled.length === shoe.length);
  check('Ace scores 10 (house rule)', rankPointValue('A') === 10);
  check('King scores 10', rankPointValue('K') === 10);
  check('7 scores 7', rankPointValue('7') === 7);
}

console.log('--- joker.js ---');
{
  check('game 1 defaults to printed', resolveJokerMode(1, 5) === 'printed');
  check('last game defaults to printed', resolveJokerMode(5, 5) === 'printed');
  check('middle game defaults to cut', resolveJokerMode(3, 5) === 'cut');

  const printedCtx = makeJokerContext(JOKER_MODES.PRINTED);
  check('printed-mode: printed joker card is wild', isWild(joker(), printedCtx));
  check('printed-mode: cut-rank does NOT apply', !isWild(card('7', 'H'), printedCtx));

  const cutCtx = makeJokerContext(JOKER_MODES.CUT, '7');
  check('cut-mode: printed joker still wild', isWild(joker(), cutCtx));
  check('cut-mode: cut-rank card is wild', isWild(card('7', 'S'), cutCtx));
  check('cut-mode: non-cut-rank card is not wild', !isWild(card('8', 'S'), cutCtx));

  const shoe = shuffle(createShoe());
  const { cutCard, cutRank, remainingShoe } = drawCutJoker(shoe);
  check('drawCutJoker returns a non-joker cut card', cutCard && !cutCard.isPrintedJoker);
  check('drawCutJoker shrinks the shoe by 1', remainingShoe.length === shoe.length - 1);
  check('cutRank matches cutCard.rank', cutRank === cutCard.rank);
}

console.log('--- meldValidator.js (printed-joker-only game) ---');
{
  const ctx = makeJokerContext(JOKER_MODES.PRINTED);

  // Valid hand: pure seq (3H4H5H) + joker seq (7S8SJoker) + set(9H9D9C) + set(KH KD KC KS)
  const hand = [
    card('3', 'H'), card('4', 'H'), card('5', 'H'),
    card('7', 'S'), card('8', 'S'), joker(),
    card('9', 'H'), card('9', 'D'), card('9', 'C'),
    card('K', 'H'), card('K', 'D'), card('K', 'C'), card('K', 'S'),
  ];
  const groups = [
    { type: 'pureSequence', cards: [hand[0], hand[1], hand[2]] },
    { type: 'jokerSequence', cards: [hand[3], hand[4], hand[5]] },
    { type: 'set', cards: [hand[6], hand[7], hand[8]] },
    { type: 'set', cards: [hand[9], hand[10], hand[11], hand[12]] },
  ];
  const result = validateDeclaration(hand, groups, ctx);
  check('valid 13-card hand passes', result.valid);
  if (!result.valid) console.log('    reasons:', result.reasons);

  // Invalid: pure sequence contains a joker
  const badGroups = JSON.parse(JSON.stringify(groups));
  const badHand = JSON.parse(JSON.stringify(hand));
  // swap: put the joker card into the "pure" group instead of jokerSequence
  const brokenGroups = [
    { type: 'pureSequence', cards: [hand[0], hand[1], hand[5]] }, // 3H 4H + joker = NOT pure
    { type: 'jokerSequence', cards: [hand[3], hand[4], hand[2]] }, // 7S 8S 5H -> not even same suit
    { type: 'set', cards: [hand[6], hand[7], hand[8]] },
    { type: 'set', cards: [hand[9], hand[10], hand[11], hand[12]] },
  ];
  const badResult = validateDeclaration(hand, brokenGroups, ctx);
  check('joker in "pure" sequence is rejected', !badResult.valid);

  // Invalid: missing a card / wrong count
  const shortGroups = [
    { type: 'pureSequence', cards: [hand[0], hand[1], hand[2]] },
    { type: 'jokerSequence', cards: [hand[3], hand[4], hand[5]] },
    { type: 'set', cards: [hand[6], hand[7], hand[8]] },
    { type: 'set', cards: [hand[9], hand[10], hand[11]] }, // only 3 of the 4 kings
  ];
  const shortResult = validateDeclaration(hand, shortGroups, ctx);
  check('using only 12 of 13 cards is rejected', !shortResult.valid);

  // Sequence with a gap that the single joker CAN fill: 7S _ 9S with a joker for 8S
  const gapHand = [card('7', 'S'), joker(), card('9', 'S')];
  const gapCheck = validateDeclaration(
    [...gapHand, ...hand.slice(0, 10)],
    [
      { type: 'jokerSequence', cards: gapHand },
      { type: 'pureSequence', cards: [hand[0], hand[1], hand[2]] },
      { type: 'set', cards: [hand[6], hand[7], hand[8]] },
      { type: 'set', cards: [hand[3], hand[4], hand[9]] }, // nonsense set on purpose, just testing gap-fill separately below
    ],
    ctx
  );
  // We only care about the gap-fill sequence check itself here, not the whole-hand structure,
  // so check isSequenceAllowingJokers directly instead for a focused unit test:
  const { isSequenceAllowingJokers } = await import('./meldValidator.js');
  const gapResult = isSequenceAllowingJokers(gapHand, ctx);
  check('7S-[joker]-9S is a valid joker-filled sequence', gapResult.valid);

  const tooBigGapHand = [card('7', 'S'), joker(), card('K', 'S')];
  const tooBigGapResult = isSequenceAllowingJokers(tooBigGapHand, ctx);
  check('7S-[joker]-KS gap is too large for one joker (rejected)', !tooBigGapResult.valid);
}

console.log('--- meldValidator.js (cut-joker game) ---');
{
  const ctx = makeJokerContext(JOKER_MODES.CUT, '7'); // rank 7 is wild this game
  // Set using a wild 7 in place of a third king
  const setCards = [card('K', 'H'), card('K', 'D'), card('7', 'C')]; // 7C is wild -> acts as 3rd king
  const setResult = validateDeclaration; // not used directly; test isSet via import
  const { isSet } = await import('./meldValidator.js');
  const wildSetResult = isSet(setCards, ctx);
  check('set with wild-rank card filling in is valid', wildSetResult.valid);

  const dupSuitSet = [card('K', 'H'), card('K', 'H'), card('K', 'D')]; // duplicate suit (would only happen via bug)
  const dupResult = isSet(dupSuitSet, ctx);
  check('set with duplicate suit is rejected', !dupResult.valid);
}

console.log('--- scoring.js ---');
{
  const ctx = makeJokerContext(JOKER_MODES.PRINTED);
  const losingHand = [card('K', 'H'), card('9', 'D'), joker(), card('A', 'C')]; // 10+9+0+10 = 29
  check('computeHandPoints sums correctly, joker=0', computeHandPoints(losingHand, ctx) === 29);

  const bigHand = Array.from({ length: 13 }, () => card('K', 'S')); // would be 130, capped at 80
  check('computeHandPoints caps at maxHandPoints (80)', computeHandPoints(bigHand, ctx) === 80);

  const deltas = scoreHand(
    {
      p1: { type: 'winner' },
      p2: { type: 'firstDrop' },
      p3: { type: 'middleDrop' },
      p4: { type: 'wrongShow' },
      p5: { type: 'showdown', cards: losingHand },
    },
    ctx
  );
  check('winner scores 0', deltas.p1 === 0);
  check('first drop scores 20', deltas.p2 === 20);
  check('middle drop scores 40', deltas.p3 === 40);
  check('wrong show scores 80', deltas.p4 === 80);
  check('showdown scores computed hand points', deltas.p5 === 29);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
