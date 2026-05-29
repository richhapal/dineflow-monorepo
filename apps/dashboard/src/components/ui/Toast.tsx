'use client';
import { useEffect, useState, createContext, useContext, useCallback } from 'react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (t: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const COLORS = {
  success: 'var(--green)',
  error:   'var(--red)',
  warning: 'var(--amber)',
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // mount → slide in
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 300);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${COLORS[item.type]}`,
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      boxShadow: '0 4px 16px rgba(0,0,0,.1)',
      width: 340,
      transform: visible ? 'translateX(0)' : 'translateX(380px)',
      opacity: visible ? 1 : 0,
      transition: 'transform .3s cubic-bezier(.22,1,.36,1), opacity .3s',
      cursor: 'pointer',
    }} onClick={() => onDismiss(item.id)}>
      <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)', marginBottom: item.message ? 2 : 0 }}>
        {item.title}
      </p>
      {item.message && (
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)', fontWeight: 300 }}>
          {item.message}
        </p>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
