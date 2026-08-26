const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = new Set(['H', 'D']);

export default function Card({ card, selected, wild, onClick, faceDown, small }) {
  if (faceDown) {
    return (
      <div
        className="playing-card face-down"
        style={cardBaseStyle(small)}
        onClick={onClick}
      />
    );
  }

  const isRed = card.suit && RED_SUITS.has(card.suit);
  return (
    <div
      className={`playing-card${selected ? ' selected' : ''}${wild ? ' wild' : ''}`}
      style={{
        ...cardBaseStyle(small),
        background: 'var(--ivory)',
        color: card.isPrintedJoker ? 'var(--brass)' : isRed ? 'var(--brick)' : 'var(--ink)',
        border: selected ? '3px solid var(--brass-bright)' : wild ? '2px solid var(--brass)' : '1px solid rgba(0,0,0,0.15)',
        transform: selected ? 'translateY(-10px)' : 'none',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {card.isPrintedJoker ? (
        <span style={{ fontWeight: 700, fontSize: small ? '0.7rem' : '0.85rem' }}>JOKER</span>
      ) : (
        <>
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{card.rank}</span>
          <span style={{ fontSize: small ? '1.1rem' : '1.4rem' }}>{SUIT_SYMBOLS[card.suit]}</span>
        </>
      )}
      {wild && !card.isPrintedJoker && (
        <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.6rem', color: 'var(--brass)' }}>W</span>
      )}
    </div>
  );
}

function cardBaseStyle(small) {
  return {
    position: 'relative',
    width: small ? 40 : 52,
    height: small ? 58 : 74,
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'transform 0.12s ease',
    background: small ? 'var(--felt-700)' : undefined,
  };
}
