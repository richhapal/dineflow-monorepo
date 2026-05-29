'use client';

interface Props {
  type: 'no-category' | 'no-items';
  onAction: () => void;
}

export function MenuEmptyState({ type, onAction }: Props) {
  const isNoCategory = type === 'no-category';

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '80px 40px', textAlign: 'center', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.25 }}>
        {isNoCategory ? '🍽' : '📋'}
      </div>
      <h3 style={{
        fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
        fontSize: 24, color: 'var(--ink)', marginBottom: 8,
      }}>
        {isNoCategory ? 'No categories yet' : 'This category is empty'}
      </h3>
      <p style={{
        fontFamily: "'Geist', sans-serif", fontWeight: 300,
        fontSize: 14, color: 'var(--ink4)', marginBottom: 24, maxWidth: 280,
      }}>
        {isNoCategory
          ? 'Start by creating your first menu category.'
          : 'Add your first menu item to get started.'}
      </p>
      <button
        onClick={onAction}
        style={{
          padding: '10px 20px', background: 'var(--ink)', color: '#fff',
          border: 'none', borderRadius: 8,
          fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14,
          cursor: 'pointer', transition: 'background .2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--ink)')}
      >
        {isNoCategory ? '+ Create first category' : '+ Add first item'}
      </button>
    </div>
  );
}
