'use client';
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MenuError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[Menu] Error boundary caught:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 56px)', gap: 16,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: 'var(--red-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
      }}>⚠</div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>
          Something went wrong
        </p>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)', marginBottom: 20, maxWidth: 320 }}>
          {error.message || 'Failed to load the menu. Please try again.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '9px 20px', background: 'var(--ink)', color: '#fff',
            border: 'none', borderRadius: 8, fontFamily: "'Geist', sans-serif",
            fontWeight: 500, fontSize: 14, cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--ink)')}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
