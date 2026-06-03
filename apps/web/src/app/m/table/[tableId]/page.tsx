'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const sans = "'Geist', system-ui, sans-serif";

export default function TableQRPage({ params }: { params: { tableId: string } }) {
  const router = useRouter();
  const [tableName, setTableName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [dots, setDots] = useState('');

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${API}/orders/table-qr/${params.tableId}`, { cache: 'no-store' });
      if (!res.ok) { setChecking(false); return; }
      const data = await res.json();
      if (data.tableName) setTableName(data.tableName);
      if (data.sessionSlug) {
        router.replace(`/m/session/${data.sessionSlug}`);
        return;
      }
    } catch {}
    setChecking(false);
  }, [params.tableId, router]);

  // Check immediately, then poll every 5 s
  useEffect(() => {
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, [check]);

  // Animate dots while polling
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f9fafb', fontFamily: sans, padding: '24px',
      textAlign: 'center',
    }}>
      {/* Spinner icon */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        border: '3px solid #e5e7eb', borderTopColor: '#111',
        animation: 'spin 0.8s linear infinite', marginBottom: 28,
      }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <p style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>
        {tableName ? `Welcome to ${tableName}` : 'Welcome!'}
      </p>

      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>
        {checking
          ? `Checking for an active session${dots}`
          : 'No active session yet.'}
      </p>

      {!checking && (
        <>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24, maxWidth: 280 }}>
            Ask your waiter to start taking orders — the menu will open automatically once the session begins.
          </p>
          <button
            onClick={() => { setChecking(true); check(); }}
            style={{
              padding: '10px 24px', borderRadius: 10,
              background: '#111', color: '#fff', border: 'none',
              fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </>
      )}
    </div>
  );
}
