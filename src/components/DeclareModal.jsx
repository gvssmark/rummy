import { useMemo, useState } from 'react';
import Card from './Card.jsx';
import { validateDeclaration } from '../game/meldValidator.js';
import { isWild } from '../game/joker.js';

const GROUP_LABELS = {
  pureSequence: 'Pure sequence',
  jokerSequence: 'Sequence (joker ok)',
  set1: 'Set 1',
  set2: 'Set 2',
};

export default function DeclareModal({ hand, jokerContext, onSubmit, onCancel, submitting, submitError }) {
  const [assignment, setAssignment] = useState({}); // cardId -> 'pureSequence' | 'jokerSequence' | 'set1' | 'set2' | 'finish'

  function setCardGroup(cardId, group) {
    setAssignment((prev) => ({ ...prev, [cardId]: group }));
  }

  const grouped = useMemo(() => {
    const g = { pureSequence: [], jokerSequence: [], set1: [], set2: [], finish: [], unassigned: [] };
    for (const card of hand) {
      const bucket = assignment[card.id] || 'unassigned';
      g[bucket].push(card);
    }
    return g;
  }, [hand, assignment]);

  const preview = useMemo(() => {
    if (grouped.finish.length !== 1) return null;
    if (grouped.unassigned.length !== 0) return null;
    const finishCardId = grouped.finish[0].id;
    const remaining = hand.filter((c) => c.id !== finishCardId);
    const groups = [
      { type: 'pureSequence', cards: grouped.pureSequence },
      { type: 'jokerSequence', cards: grouped.jokerSequence },
      { type: 'set', cards: grouped.set1 },
      { type: 'set', cards: grouped.set2 },
    ];
    return validateDeclaration(remaining, groups, jokerContext);
  }, [grouped, hand, jokerContext]);

  function handleSubmit() {
    const finishCardId = grouped.finish[0].id;
    const groups = [
      { type: 'pureSequence', cards: grouped.pureSequence },
      { type: 'jokerSequence', cards: grouped.jokerSequence },
      { type: 'set', cards: grouped.set1 },
      { type: 'set', cards: grouped.set2 },
    ];
    onSubmit(groups, finishCardId);
  }

  return (
    <div style={overlayStyle}>
      <div className="panel stack" style={{ maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.1rem' }}>Arrange your declare</h3>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Tap a card, then tap where it goes. You need 1 pure sequence, 1 sequence
          (joker allowed), 2 sets, and 1 card set aside to finish with.
        </p>

        <GroupRow label="Unassigned" cards={grouped.unassigned} jokerContext={jokerContext}
          onAssign={(id) => setCardGroup(id, 'pureSequence')} assignOptions={assignOptionsFor('unassigned')}
          onPick={setCardGroup} />

        {['pureSequence', 'jokerSequence', 'set1', 'set2', 'finish'].map((key) => (
          <GroupRow
            key={key}
            label={key === 'finish' ? 'Finish card (discarded)' : GROUP_LABELS[key]}
            cards={grouped[key]}
            jokerContext={jokerContext}
            onPick={setCardGroup}
            assignOptions={assignOptionsFor(key)}
          />
        ))}

        {preview && (
          <div className={preview.valid ? 'panel' : 'panel'} style={{ background: preview.valid ? 'rgba(201,162,39,0.18)' : 'rgba(181,83,60,0.18)' }}>
            {preview.valid ? (
              <p style={{ margin: 0 }}>✓ This looks like a valid declare.</p>
            ) : (
              <div>
                <p style={{ margin: '0 0 6px' }}>Not valid yet:</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem' }}>
                  {preview.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {submitError && <p className="error-text">{submitError}</p>}

        <div className="row" style={{ gap: 10 }}>
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={submitting || grouped.unassigned.length !== 0 || grouped.finish.length !== 1}
          >
            {submitting ? 'Submitting…' : 'Declare'}
          </button>
        </div>
      </div>
    </div>
  );
}

function assignOptionsFor(currentKey) {
  return ['unassigned', 'pureSequence', 'jokerSequence', 'set1', 'set2', 'finish'].filter((k) => k !== currentKey);
}

function GroupRow({ label, cards, jokerContext, onPick, assignOptions }) {
  const [pickingId, setPickingId] = useState(null);
  return (
    <div>
      <div className="muted" style={{ fontSize: '0.75rem', marginBottom: 4 }}>{label} ({cards.length})</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {cards.map((card) => (
          <div key={card.id} style={{ position: 'relative' }}>
            <Card card={card} small wild={isWild(card, jokerContext)} onClick={() => setPickingId(pickingId === card.id ? null : card.id)} />
            {pickingId === card.id && (
              <div style={pickerStyle}>
                {assignOptions.map((opt) => (
                  <button
                    key={opt}
                    className="secondary"
                    style={{ display: 'block', width: '100%', fontSize: '0.75rem', padding: '6px 10px', marginBottom: 2 }}
                    onClick={() => { onPick(card.id, opt === 'unassigned' ? undefined : opt); setPickingId(null); }}
                  >
                    {opt === 'unassigned' ? 'Move to unassigned' : GROUP_LABELS[opt] || 'Finish card'}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {cards.length === 0 && <span className="muted" style={{ fontSize: '0.8rem' }}>—</span>}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 50,
  padding: 12,
};

const pickerStyle = {
  position: 'absolute',
  bottom: '105%',
  left: 0,
  background: 'var(--felt-900)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: 6,
  zIndex: 60,
  minWidth: 140,
};
