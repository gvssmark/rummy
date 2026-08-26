import { dealGame } from './dealer.js';
import { drawCard, discardCard, dropPlayer, declare } from './gameEngine.js';

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

// Deterministic RNG for reproducible test deals.
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

console.log('--- dealer.js ---');
{
  const players = ['alice', 'bob', 'carol'];
  const state = dealGame(players, 1, 5, {}, seededRng(42));
  check('each player has 13 cards', players.every((p) => state.hands[p].length === 13));
  check('game 1 uses printed joker mode', state.jokerMode === 'printed');
  check('draw pile + discard pile + hands = 108', (() => {
    const handTotal = players.reduce((sum, p) => sum + state.hands[p].length, 0);
    return handTotal + state.drawPile.length + state.discardPile.length === 108;
  })());
  check('turn starts with player 0, awaitingDraw', currentPlayerCheck(state));

  function currentPlayerCheck(s) {
    return s.turnOrder[s.currentTurnIndex] === 'alice' && s.turnPhase === 'awaitingDraw';
  }

  const middleGameState = dealGame(players, 3, 5, {}, seededRng(7));
  check('middle game uses cut joker mode', middleGameState.jokerMode === 'cut');
  check('cut game has a resolved cutRank', typeof middleGameState.jokerContext.cutRank === 'string');

  const g1 = dealGame(players, 1, 5, {}, seededRng(9));
  const g2 = dealGame(players, 2, 5, {}, seededRng(9));
  const g3 = dealGame(players, 3, 5, {}, seededRng(9));
  const g4 = dealGame(players, 4, 5, {}, seededRng(9));
  check('game 1 starts with player 0 (alice)', g1.turnOrder[0] === 'alice');
  check('game 2 starts with player 1 (bob) — rotates', g2.turnOrder[0] === 'bob');
  check('game 3 starts with player 2 (carol) — rotates', g3.turnOrder[0] === 'carol');
  check('game 4 wraps back around to alice', g4.turnOrder[0] === 'alice');
}

console.log('--- gameEngine.js: draw/discard/turn rotation ---');
{
  const players = ['alice', 'bob', 'carol'];
  let state = dealGame(players, 1, 5, {}, seededRng(1));

  state = drawCard(state, 'alice', 'draw');
  check('alice hand grows to 14 after draw', state.hands.alice.length === 14);
  check('phase moves to awaitingDiscardOrDeclare', state.turnPhase === 'awaitingDiscardOrDeclare');

  let threw = false;
  try {
    drawCard(state, 'bob', 'draw');
  } catch (e) {
    threw = true;
  }
  check('bob cannot draw out of turn', threw);

  const cardToDiscard = state.hands.alice[0].id;
  state = discardCard(state, 'alice', cardToDiscard);
  check('alice hand shrinks back to 13 after discard', state.hands.alice.length === 13);
  check('turn passes to bob', state.turnOrder[state.currentTurnIndex] === 'bob');
  check('phase resets to awaitingDraw', state.turnPhase === 'awaitingDraw');
}

console.log('--- gameEngine.js: drop scoring ---');
{
  const players = ['alice', 'bob', 'carol'];
  let state = dealGame(players, 1, 5, {}, seededRng(2));

  // Alice drops immediately (before ever drawing) -> first drop.
  state = dropPlayer(state, 'alice');
  check('alice marked as first drop', state.droppedPlayers.alice === 'first');
  check('turn passes to bob after alice drops', state.turnOrder[state.currentTurnIndex] === 'bob');

  // Bob takes a full turn, then later drops (would be middle drop).
  state = drawCard(state, 'bob', 'draw');
  const bobDiscard = state.hands.bob[0].id;
  state = discardCard(state, 'bob', bobDiscard);
  // turn now at carol; carol takes a turn so it comes back to bob
  state = drawCard(state, 'carol', 'draw');
  const carolDiscard = state.hands.carol[0].id;
  state = discardCard(state, 'carol', carolDiscard);
  // back to bob's turn
  state = dropPlayer(state, 'bob');
  check('bob marked as middle drop (had already taken a turn)', state.droppedPlayers.bob === 'middle');
  check('only carol remains active -> game auto-finishes with carol as winner', state.status === 'finished' && state.winnerId === 'carol');
}

console.log('--- gameEngine.js: declare (valid) ---');
{
  // Build a fully controlled scenario rather than relying on a random deal,
  // so we can hand-craft a guaranteed-winning hand.
  const players = ['alice', 'bob'];
  let state = dealGame(players, 1, 5, {}, seededRng(3));

  // Force alice's hand into a known-winning shape using real cards pulled
  // from the shoe logic (deck.js), ignoring whatever she was actually dealt,
  // since this test targets declare() in isolation, not the deal itself.
  const { createShoe } = await import('./deck.js');
  const shoe = createShoe();
  const find = (rank, suit) => shoe.find((c) => c.rank === rank && c.suit === suit && !c.isPrintedJoker);
  const printedJoker = shoe.find((c) => c.isPrintedJoker);

  const winningHand = [
    find('3', 'H'), find('4', 'H'), find('5', 'H'),       // pure sequence
    find('7', 'S'), find('8', 'S'), printedJoker,          // joker sequence (fills 9S)
    find('9', 'H'), find('9', 'D'), find('9', 'C'),        // set
    find('K', 'H'), find('K', 'D'), find('K', 'C'), find('K', 'S'), // set
    find('2', 'C'), // 14th card, to be discarded as the finishing card
  ];
  state = {
    ...state,
    hands: { ...state.hands, alice: winningHand },
    turnOrder: ['alice', 'bob'],
    currentTurnIndex: 0,
    turnPhase: 'awaitingDiscardOrDeclare', // pretend she already drew
  };

  const groups = [
    { type: 'pureSequence', cards: [winningHand[0], winningHand[1], winningHand[2]] },
    { type: 'jokerSequence', cards: [winningHand[3], winningHand[4], winningHand[5]] },
    { type: 'set', cards: [winningHand[6], winningHand[7], winningHand[8]] },
    { type: 'set', cards: [winningHand[9], winningHand[10], winningHand[11], winningHand[12]] },
  ];
  const finishCardId = winningHand[13].id;

  const finalState = declare(state, 'alice', groups, finishCardId);
  check('valid declare ends the game', finalState.status === 'finished');
  check('alice is the winner', finalState.winnerId === 'alice');
  check('alice scores 0', finalState.finishedOutcomes.deltas.alice === 0);
  check('bob is scored at showdown (not winner)', finalState.finishedOutcomes.outcomes.bob.type === 'showdown');
}

console.log('--- gameEngine.js: declare (invalid / wrong show) ---');
{
  const players = ['alice', 'bob'];
  let state = dealGame(players, 1, 5, {}, seededRng(4));
  const { createShoe } = await import('./deck.js');
  const shoe = createShoe();
  const find = (rank, suit) => shoe.find((c) => c.rank === rank && c.suit === suit && !c.isPrintedJoker);

  // Junk hand - definitely not a valid declaration.
  const junkHand = [
    find('3', 'H'), find('4', 'S'), find('5', 'D'),
    find('7', 'S'), find('8', 'H'), find('2', 'D'),
    find('9', 'H'), find('9', 'D'), find('6', 'C'),
    find('K', 'H'), find('K', 'D'), find('Q', 'C'), find('J', 'S'),
    find('2', 'C'),
  ];
  state = {
    ...state,
    hands: { ...state.hands, alice: junkHand },
    turnOrder: ['alice', 'bob'],
    currentTurnIndex: 0,
    turnPhase: 'awaitingDiscardOrDeclare',
  };
  const bogusGroups = [
    { type: 'pureSequence', cards: [junkHand[0], junkHand[1], junkHand[2]] },
    { type: 'jokerSequence', cards: [junkHand[3], junkHand[4], junkHand[5]] },
    { type: 'set', cards: [junkHand[6], junkHand[7], junkHand[8]] },
    { type: 'set', cards: [junkHand[9], junkHand[10], junkHand[11], junkHand[12]] },
  ];
  const finalState = declare(state, 'alice', bogusGroups, junkHand[13].id);
  check('invalid declare ends the game without a winner', finalState.status === 'finished' && finalState.winnerId === null);
  check('alice is penalized as wrongShow (80 pts)', finalState.finishedOutcomes.deltas.alice === 80);
  check('reasons are recorded for the failed declare', finalState.finishedOutcomes.declareReasons.length > 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
