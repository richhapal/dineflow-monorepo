'use client';
import React, { useState, useEffect } from 'react';
import { useDeleteTable, RestaurantTable } from './useTablesQR';
import { useToast } from '@/components/ui/Toast';

type Scenario = 'clean' | 'active_order' | 'historical' | 'active_session' | null;

interface DeleteTableConfirmProps {
  table: RestaurantTable;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteTableConfirm({
  table,
  onClose,
  onDeleted,
}: DeleteTableConfirmProps) {
  const { showToast } = useToast();
  const deleteTable = useDeleteTable();
  const [scenario, setScenario] = useState<Scenario>(null);
  const [loading, setLoading] = useState(false);

  // If the table has an active session or order, pre-determine scenario
  useEffect(() => {
    if (table.current_session_id) {
      setScenario('active_session');
    } else if (table.current_order_id) {
      setScenario('active_order');
    } else {
      setScenario('clean');
    }
  }, [table]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteTable.mutateAsync(table.id);
      showToast({ type: 'success', title: `Table ${table.name} deleted` });
      onDeleted();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; has_orders?: boolean } } };
      if (error?.response?.status === 409) {
        const data = error.response.data;
        if (data?.message?.toLowerCase().includes('session')) {
          setScenario('active_session');
        } else if (data?.message?.toLowerCase().includes('order')) {
          if (data?.has_orders) {
            setScenario('historical');
          } else {
            setScenario('active_order');
          }
        } else {
          setScenario('historical');
        }
      } else {
        showToast({ type: 'error', title: 'Failed to delete table' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.35)',
          zIndex: 200,
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 201,
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,.16)',
          width: 400,
          maxWidth: '95vw',
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scenario: clean delete */}
        {(scenario === null || scenario === 'clean') && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#fff2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  marginBottom: 14,
                }}
              >
                🗑
              </div>
              <h3
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--ink)',
                  marginBottom: 6,
                }}
              >
                Delete {table.name}?
              </h3>
              <p
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: 'var(--ink4)',
                  lineHeight: 1.5,
                }}
              >
                This will permanently delete the table and its QR codes. This
                action cannot be undone.
              </p>
            </div>
            <ActionButtons
              onCancel={onClose}
              onConfirm={handleDelete}
              loading={loading}
              confirmLabel="Delete table"
              danger
            />
          </>
        )}

        {/* Scenario: blocked by active order */}
        {scenario === 'active_order' && (
          <>
            <BlockedHeader
              emoji="🧾"
              title="Cannot delete — active order"
              description={`Table ${table.name} has an active order in progress. Please close or cancel the order before deleting.`}
            />
            <button
              onClick={onClose}
              style={cancelBtnStyle}
            >
              Close
            </button>
          </>
        )}

        {/* Scenario: blocked by active session */}
        {scenario === 'active_session' && (
          <>
            <BlockedHeader
              emoji="👥"
              title="Cannot delete — active session"
              description={`Table ${table.name} has an active group session. Please end the session before deleting.`}
            />
            <button
              onClick={onClose}
              style={cancelBtnStyle}
            >
              Close
            </button>
          </>
        )}

        {/* Scenario: has historical orders but no active orders/sessions */}
        {scenario === 'historical' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#fff8e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  marginBottom: 14,
                }}
              >
                ⚠️
              </div>
              <h3
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--ink)',
                  marginBottom: 6,
                }}
              >
                Table has historical orders
              </h3>
              <p
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: 'var(--ink4)',
                  lineHeight: 1.5,
                }}
              >
                {table.name} has past orders in the system. Deleting it will
                remove the table but historical order records will be retained for
                reporting purposes.
              </p>
            </div>
            <ActionButtons
              onCancel={onClose}
              onConfirm={handleDelete}
              loading={loading}
              confirmLabel="Delete anyway"
              danger
            />
          </>
        )}
      </div>
    </>
  );
}

function BlockedHeader({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--amber-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          marginBottom: 14,
        }}
      >
        {emoji}
      </div>
      <h3
        style={{
          fontFamily: "'Geist', sans-serif",
          fontWeight: 600,
          fontSize: 16,
          color: 'var(--ink)',
          marginBottom: 6,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
          color: 'var(--ink4)',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function ActionButtons({
  onCancel,
  onConfirm,
  loading,
  confirmLabel,
  danger,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  confirmLabel: string;
  danger?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
      <button
        onClick={onCancel}
        style={cancelBtnStyle}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        style={{
          padding: '9px 20px',
          background: danger ? 'var(--red)' : 'var(--ink)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontFamily: "'Geist', sans-serif",
          fontWeight: 500,
          fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Deleting…' : confirmLabel}
      </button>
    </div>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 20px',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  background: 'transparent',
  fontFamily: "'Geist', sans-serif",
  fontSize: 14,
  color: 'var(--ink3)',
  cursor: 'pointer',
};
