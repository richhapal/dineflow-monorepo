'use client';
import { useState, useEffect } from 'react';

interface OrderingStatus {
  is_ordering_paused: boolean;
  ordering_pause_reason: string | null;
  ordering_pause_until: string | null;
}

interface Props {
  restaurantId: string;
  token: string;
  /** Optional: external status from WebSocket to keep UI in sync */
  externalStatus?: { paused: boolean; reason: string | null } | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function PauseOrderingToggle({ restaurantId, token, externalStatus }: Props) {
  const [status, setStatus] = useState<OrderingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  // Fetch current status
  useEffect(() => {
    fetch(`${API}/restaurants/me/ordering-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStatus)
      .catch(console.error);
  }, [token]);

  // Sync from WebSocket updates
  useEffect(() => {
    if (externalStatus) {
      setStatus((prev) =>
        prev
          ? { ...prev, is_ordering_paused: externalStatus.paused, ordering_pause_reason: externalStatus.reason }
          : null,
      );
    }
  }, [externalStatus]);

  const handleToggle = async () => {
    if (!status) return;
    if (!status.is_ordering_paused) {
      // About to pause — show reason input first
      setShowReasonInput(true);
      return;
    }
    // Resume immediately
    await applyPause(false, '');
  };

  const applyPause = async (paused: boolean, pauseReason: string) => {
    setLoading(true);
    setShowReasonInput(false);
    try {
      const res = await fetch(`${API}/restaurants/${restaurantId}/ordering-pause`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paused, reason: pauseReason || undefined }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStatus((prev) => (prev ? { ...prev, ...updated } : null));
        setReason('');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!status) return null;

  const isPaused = status.is_ordering_paused;

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      padding: '16px 20px',
    }}>
      {/* Toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
            Ordering
          </p>
          <span style={{
            fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 500,
            color: isPaused ? 'var(--red)' : 'var(--green)',
            background: isPaused ? 'var(--red-bg)' : 'var(--green-bg)',
            padding: '2px 8px', borderRadius: 100,
          }}>
            {isPaused ? '⏸ Paused' : '● Active'}
          </span>
        </div>
        {/* Toggle switch */}
        <div
          role="switch"
          aria-checked={!isPaused}
          onClick={loading ? undefined : handleToggle}
          style={{
            width: 40, height: 22, borderRadius: 11, cursor: loading ? 'not-allowed' : 'pointer',
            background: isPaused ? 'var(--border2)' : '#2D7A4A',
            position: 'relative', transition: 'background .2s', opacity: loading ? 0.6 : 1,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: isPaused ? 3 : 21,
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </div>
      </div>

      {isPaused && status.ordering_pause_reason && (
        <p style={{
          marginTop: 8, fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)',
          background: 'var(--paper2)', padding: '4px 8px', borderRadius: 6,
        }}>
          Reason: {status.ordering_pause_reason}
        </p>
      )}

      {showReasonInput && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)', marginBottom: 6 }}>
            Optional: tell customers why (shown on menu)
          </p>
          <input
            style={{
              width: '100%', fontFamily: "'Geist', sans-serif", fontSize: 12,
              border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px',
              background: 'var(--paper)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
            }}
            placeholder="e.g. Kitchen is at capacity"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={120}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              disabled={loading}
              onClick={() => applyPause(true, reason)}
              style={{
                fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 500,
                background: 'var(--red)', color: '#fff', border: 'none',
                borderRadius: 6, padding: '5px 14px', cursor: 'pointer',
              }}
            >
              Pause ordering
            </button>
            <button
              onClick={() => setShowReasonInput(false)}
              style={{
                fontFamily: "'Geist', sans-serif", fontSize: 12,
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: 'var(--ink4)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
