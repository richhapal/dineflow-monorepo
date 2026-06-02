'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useDashboardStore } from '@/lib/store';
import { useSocket } from '@/hooks/useSocket';
import type { Order, OrderStatus } from '@dineflow/types';

type Columns = { PENDING: Order[]; PREPARING: Order[]; READY: Order[] };

// ─── Elapsed timer ────────────────────────────────────────────────────────────

function elapsedMin(created_at: string): number {
  return Math.floor((Date.now() - new Date(created_at).getTime()) / 60000);
}

function ElapsedBadge({ created_at }: { created_at: string }) {
  const [min, setMin] = useState(elapsedMin(created_at));
  useEffect(() => {
    const t = setInterval(() => setMin(elapsedMin(created_at)), 30000);
    return () => clearInterval(t);
  }, [created_at]);
  const late = min > 30;
  return (
    <span style={{
      fontFamily: "'Geist Mono', monospace", fontSize: 12,
      color: late ? 'var(--red)' : 'var(--ink5)', display: 'flex', alignItems: 'center', gap: 4,
    }}>
      🕐 {min}m ago
    </span>
  );
}

// ─── Countdown timer for auto-cancel ─────────────────────────────────────────

function TimeoutCountdown({ created_at, timeoutMin }: { created_at: string; timeoutMin: number }) {
  const getSecsLeft = () => {
    const elapsed = (Date.now() - new Date(created_at).getTime()) / 1000;
    return Math.max(0, timeoutMin * 60 - elapsed);
  };
  const [secsLeft, setSecsLeft] = useState(getSecsLeft());

  useEffect(() => {
    const t = setInterval(() => setSecsLeft(getSecsLeft()), 1000);
    return () => clearInterval(t);
  }, [created_at, timeoutMin]);

  if (secsLeft <= 0) return null;

  const pct = (secsLeft / (timeoutMin * 60)) * 100;
  const urgent = secsLeft < 120; // < 2min
  const minsLeft = Math.floor(secsLeft / 60);
  const sLeft = Math.floor(secsLeft % 60);
  const label = minsLeft > 0 ? `${minsLeft}m ${sLeft}s` : `${sLeft}s`;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{
          fontFamily: "'Geist', sans-serif", fontSize: 10, fontWeight: 500,
          color: urgent ? 'var(--red)' : 'var(--ink4)',
        }}>
          {urgent ? '⚠ Auto-cancel in' : '⏱ Accept within'} {label}
        </span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'var(--paper3)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, transition: 'width 1s linear',
          width: `${pct}%`,
          background: urgent ? 'var(--red)' : pct < 40 ? 'var(--amber)' : 'var(--green)',
        }} />
      </div>
    </div>
  );
}

// ─── Decline modal ────────────────────────────────────────────────────────────

const DECLINE_REASONS = [
  'Kitchen is full — try again soon',
  'Item unavailable',
  'Closing soon',
  'Order cannot be fulfilled',
];

function DeclineModal({ orderId, onDecline, onCancel }: {
  orderId: string;
  onDecline: (id: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setLoading(true);
    await onDecline(orderId, reason.trim());
    setLoading(false);
  }

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#fff', borderRadius: 14, padding: '24px',
        width: 360, zIndex: 901, boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: 'var(--ink)' }}>
            Decline order
          </h3>
          <button onClick={onCancel} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'var(--paper2)',
            border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--ink3)',
          }}>×</button>
        </div>

        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)', marginBottom: 14 }}>
          Select a reason — this will be shown to the customer.
        </p>

        {/* Quick reasons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {DECLINE_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => { setReason(r); setCustom(false); }}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1.5px solid',
                borderColor: reason === r && !custom ? 'var(--accent)' : 'var(--border)',
                background: reason === r && !custom ? '#FDF5EF' : '#fff',
                fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)',
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => { setCustom(true); setReason(''); }}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1.5px dashed',
              borderColor: custom ? 'var(--accent)' : 'var(--border2)',
              background: custom ? '#FDF5EF' : '#fff',
              fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)',
              textAlign: 'left', cursor: 'pointer',
            }}
          >
            ✏️ Custom reason…
          </button>
        </div>

        {custom && (
          <textarea
            autoFocus
            placeholder="Type reason for customer…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={200}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1.5px solid var(--border)', fontSize: 13,
              fontFamily: "'Geist', sans-serif", color: 'var(--ink)', resize: 'none',
              outline: 'none', boxSizing: 'border-box', marginBottom: 10,
            }}
          />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            disabled={!reason.trim() || loading}
            onClick={handleSubmit}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: reason.trim() ? 'var(--red)' : 'var(--paper3)',
              color: reason.trim() ? '#fff' : 'var(--ink5)',
              fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 14,
              cursor: reason.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Declining…' : 'Decline order'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 16px', borderRadius: 8,
              border: '1.5px solid var(--border2)', background: '#fff',
              fontFamily: "'Geist', sans-serif", fontSize: 14, color: 'var(--ink3)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Modify order modal ───────────────────────────────────────────────────────

type ItemMod = {
  item_id: string;
  quantity: number;
  is_unavailable: boolean;
  unavailable_reason: string;
};

function ModifyOrderModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: (updatedOrder: Order) => void;
}) {
  const activeItems = order.items.filter((i) => !(i as any).is_cancelled);

  const [mods, setMods] = useState<Record<string, ItemMod>>(() => {
    const init: Record<string, ItemMod> = {};
    activeItems.forEach((item) => {
      init[item.id] = {
        item_id: item.id,
        quantity: item.quantity,
        is_unavailable: false,
        unavailable_reason: '',
      };
    });
    return init;
  });
  const [waiterNote, setWaiterNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setQty(itemId: string, delta: number) {
    setMods((prev) => {
      const cur = prev[itemId];
      const next = Math.max(0, cur.quantity + delta);
      return { ...prev, [itemId]: { ...cur, quantity: next, is_unavailable: next === 0 ? cur.is_unavailable : false } };
    });
  }

  function toggleUnavailable(itemId: string) {
    setMods((prev) => {
      const cur = prev[itemId];
      return { ...prev, [itemId]: { ...cur, is_unavailable: !cur.is_unavailable, quantity: cur.is_unavailable ? 1 : 0 } };
    });
  }

  function setReason(itemId: string, reason: string) {
    setMods((prev) => ({ ...prev, [itemId]: { ...prev[itemId], unavailable_reason: reason } }));
  }

  const hasChanges = activeItems.some((item) => {
    const m = mods[item.id];
    return m.is_unavailable || m.quantity !== item.quantity || m.quantity === 0;
  });

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const modifications = activeItems
        .map((item) => {
          const m = mods[item.id];
          if (m.is_unavailable || m.quantity === 0) {
            return {
              item_id: item.id,
              quantity: 0,
              is_unavailable: true,
              unavailable_reason: m.unavailable_reason || 'Item unavailable',
            };
          }
          if (m.quantity !== item.quantity) {
            return { item_id: item.id, quantity: m.quantity };
          }
          return null;
        })
        .filter(Boolean);

      if (modifications.length === 0 && !waiterNote.trim()) {
        setError('No changes to save.');
        setSaving(false);
        return;
      }

      const res = await api.patch(`/orders/${order.id}/modify`, {
        modifications,
        waiter_note: waiterNote.trim() || undefined,
      });
      onSaved(res.data);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        background: '#fff', borderRadius: 16, width: 440,
        maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        zIndex: 901, boxShadow: '0 24px 64px rgba(0,0,0,.18)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 22px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: 'var(--ink)', marginBottom: 2 }}>
              Modify order
            </h3>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink4)' }}>
              #{order.id.slice(-8).toUpperCase()} · {order.customer_name || 'Guest'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--paper2)', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink3)' }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '16px 22px', flex: 1 }}>
          {/* Items */}
          <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Items
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {activeItems.map((item) => {
              const m = mods[item.id];
              const isMarked = m.is_unavailable || m.quantity === 0;
              return (
                <div key={item.id} style={{
                  borderRadius: 10,
                  border: `1.5px solid ${isMarked ? 'var(--red)' : 'var(--border)'}`,
                  background: isMarked ? '#FFF5F5' : '#fff',
                  padding: '10px 12px',
                  transition: 'all .15s',
                }}>
                  {/* Item name + qty stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      flex: 1,
                      fontFamily: "'Geist', sans-serif", fontSize: 13,
                      color: isMarked ? 'var(--ink4)' : 'var(--ink)',
                      textDecoration: isMarked ? 'line-through' : 'none',
                      fontWeight: 500,
                    }}>
                      {item.item_name}
                    </span>

                    {/* Qty stepper */}
                    {!isMarked && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => setQty(item.id, -1)}
                          disabled={m.quantity <= 1}
                          style={{
                            width: 26, height: 26, borderRadius: 6,
                            border: '1.5px solid var(--border2)', background: '#fff',
                            fontFamily: "'Geist', sans-serif", fontSize: 16, cursor: m.quantity <= 1 ? 'not-allowed' : 'pointer',
                            color: m.quantity <= 1 ? 'var(--ink5)' : 'var(--ink)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >−</button>
                        <span style={{
                          fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 600,
                          color: m.quantity !== item.quantity ? 'var(--accent)' : 'var(--ink)',
                          minWidth: 20, textAlign: 'center',
                        }}>{m.quantity}</span>
                        <button
                          onClick={() => setQty(item.id, +1)}
                          style={{
                            width: 26, height: 26, borderRadius: 6,
                            border: '1.5px solid var(--border2)', background: '#fff',
                            fontFamily: "'Geist', sans-serif", fontSize: 16, cursor: 'pointer', color: 'var(--ink)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >+</button>
                      </div>
                    )}

                    {/* Mark unavailable toggle */}
                    <button
                      onClick={() => toggleUnavailable(item.id)}
                      title={isMarked ? 'Restore item' : 'Mark as unavailable'}
                      style={{
                        padding: '4px 9px', borderRadius: 6,
                        border: `1.5px solid ${isMarked ? 'var(--red)' : 'var(--border2)'}`,
                        background: isMarked ? '#FEE2E2' : 'var(--paper2)',
                        color: isMarked ? 'var(--red)' : 'var(--ink4)',
                        fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      {isMarked ? '↩ Restore' : '✕ Unavailable'}
                    </button>
                  </div>

                  {/* Reason field when marked unavailable */}
                  {isMarked && (
                    <input
                      autoFocus
                      placeholder='Reason (e.g. "Ran out of stock")'
                      value={m.unavailable_reason}
                      onChange={(e) => setReason(item.id, e.target.value)}
                      maxLength={120}
                      style={{
                        marginTop: 8, width: '100%', padding: '7px 10px',
                        borderRadius: 7, border: '1.5px solid var(--border)',
                        fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink)',
                        outline: 'none', boxSizing: 'border-box' as const,
                        background: '#fff',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Waiter note */}
          <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Message to customer <span style={{ fontWeight: 400, color: 'var(--ink5)' }}>(optional)</span>
          </p>
          <textarea
            placeholder='E.g. "We replaced the Paneer Tikka with Veg Tikka — same price. Apologies for the inconvenience!"'
            value={waiterNote}
            onChange={(e) => setWaiterNote(e.target.value)}
            rows={3}
            maxLength={400}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1.5px solid var(--border)', resize: 'none',
              fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)',
              outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)', marginTop: 4 }}>
            {waiterNote.length}/400 · This message is shown to the customer in real time.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
        }}>
          {error && (
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>
              ⚠ {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || (!hasChanges && !waiterNote.trim())}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                background: (hasChanges || waiterNote.trim()) && !saving ? 'var(--ink)' : 'var(--paper3)',
                color: (hasChanges || waiterNote.trim()) && !saving ? '#fff' : 'var(--ink5)',
                fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 14,
                cursor: (hasChanges || waiterNote.trim()) && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Saving…' : '✓ Save & notify customer'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 18px', borderRadius: 8,
                border: '1.5px solid var(--border2)', background: '#fff',
                fontFamily: "'Geist', sans-serif", fontSize: 14, color: 'var(--ink3)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Order type config ────────────────────────────────────────────────────────

const ORDER_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string; accentBar: string }> = {
  DINE_IN:       { icon: '🍽', label: 'Dine-in',       color: '#1E40AF', bg: '#EFF6FF',  accentBar: '#3B82F6' },
  TAKEAWAY:      { icon: '🛍', label: 'Outside Order',  color: '#C2410C', bg: '#FFF7ED',  accentBar: '#F97316' },
  ROOM_SERVICE:  { icon: '🛎', label: 'Room service',   color: '#6D28D9', bg: '#EDE9FE',  accentBar: '#7C3AED' },
  WAITER_PLACED: { icon: '🧑‍🍳', label: 'Waiter placed', color: '#065F46', bg: '#ECFDF5', accentBar: '#10B981' },
};

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onAction,
  onDecline,
  onModify,
  timeoutMin,
}: {
  order: Order;
  onAction: (id: string, status: OrderStatus) => void;
  onDecline: (id: string) => void;
  onModify: (order: Order) => void;
  timeoutMin: number;
}) {
  const nextStatus: Record<string, { label: string; status: OrderStatus; bg: string; color: string; border: string }> = {
    PENDING:   { label: 'Confirm order',   status: 'CONFIRMED' as OrderStatus, bg: 'var(--blue-bg)',  color: 'var(--blue)',  border: '1px solid rgba(24,95,165,.2)' },
    CONFIRMED: { label: 'Start preparing', status: 'PREPARING' as OrderStatus, bg: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid rgba(180,83,9,.2)' },
    PREPARING: { label: 'Mark as ready ✓', status: 'READY' as OrderStatus,     bg: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(45,122,74,.2)' },
    READY:     { label: 'Mark as served',  status: 'SERVED' as OrderStatus,     bg: 'var(--accent)',   color: '#fff',         border: 'none' },
  };

  const action = nextStatus[order.status];
  const isPending = order.status === 'PENDING';
  const canDecline = order.status === 'PENDING' || order.status === 'CONFIRMED';

  const orderType = order.order_type as string;
  const typeConfig = ORDER_TYPE_CONFIG[orderType] || ORDER_TYPE_CONFIG['DINE_IN'];

  // Relations included by the API
  const table  = (order as any).table  as { name: string; section?: string } | null;
  const room   = (order as any).room   as { name: string } | null;
  const seatId = (order as any).seat_identifier as string | undefined;
  const sessionId = (order as any).order_session_id as string | undefined;

  // Location context line
  let locationLabel: string | null = null;
  if (table)   locationLabel = `Table ${table.name}${table.section ? ` · ${table.section}` : ''}`;
  else if (room) locationLabel = `Room ${room.name}`;
  else if (seatId) locationLabel = seatId;

  // Item totals
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const showItems  = order.items.slice(0, 5);
  const extraCount = order.items.length - 5;

  return (
    <div style={{
      background: '#fff',
      border: isPending ? '1.5px solid rgba(180,83,9,.18)' : '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 8,
      overflow: 'hidden',
      transition: 'box-shadow .15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.07)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* ── Colored top accent strip by order type ── */}
      <div style={{ height: 3, background: typeConfig.accentBar }} />

      <div style={{ padding: '12px 14px' }}>

        {/* ── Row 1: order# · type badge · total ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          {/* Order type icon badge */}
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: typeConfig.bg, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            {typeConfig.icon}
          </div>

          {/* Order # */}
          <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 12,
            color: 'var(--ink3)', fontWeight: 600, letterSpacing: '.02em',
          }}>
            #{order.id.slice(-8).toUpperCase()}
          </span>

          {/* Order type pill */}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
            background: typeConfig.bg, color: typeConfig.color,
            fontFamily: "'Geist', sans-serif", letterSpacing: '.04em',
            textTransform: 'uppercase' as const,
          }}>
            {typeConfig.label}
          </span>

          {/* Location context */}
          {locationLabel && (
            <span style={{
              fontSize: 11, color: 'var(--ink4)',
              fontFamily: "'Geist', sans-serif",
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
            }}>
              · {locationLabel}
            </span>
          )}

          {/* Total — right-aligned */}
          <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700,
            color: 'var(--ink)', marginLeft: 'auto', flexShrink: 0,
          }}>
            ₹{Number(order.total_amount).toFixed(0)}
          </span>
        </div>

        {/* ── Row 2: Customer + elapsed + item count ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{
            fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink)',
          }}>
            {order.customer_name || 'Guest'}
          </span>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)' }}>
            · {order.covers} guest{order.covers !== 1 ? 's' : ''}
          </span>
          <span style={{
            marginLeft: 'auto', fontFamily: "'Geist', sans-serif", fontSize: 11,
            color: 'var(--ink5)', background: 'var(--paper3)',
            padding: '1px 6px', borderRadius: 4, flexShrink: 0,
          }}>
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
          <ElapsedBadge created_at={order.created_at} />
        </div>

        {/* ── Row 3: Contact / location details (takeaway) ── */}
        {(order.customer_phone || seatId || sessionId) && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 8 }}>
            {order.customer_phone && (
              <span style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 11,
                background: 'var(--paper2)', color: 'var(--ink3)',
                borderRadius: 5, padding: '2px 7px',
                border: '1px solid var(--border)',
              }}>
                📞 {order.customer_phone}
              </span>
            )}
            {seatId && (
              <span style={{
                fontFamily: "'Geist', sans-serif", fontSize: 11,
                background: 'var(--paper2)', color: 'var(--ink3)',
                borderRadius: 5, padding: '2px 7px',
                border: '1px solid var(--border)',
              }}>
                📍 {seatId}
              </span>
            )}
            {sessionId && (
              <span style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                background: '#EEF2FF', color: '#3730A3',
                borderRadius: 5, padding: '2px 7px',
                border: '1px solid #C7D2FE',
              }} title="Queue session ID">
                🎫 {sessionId}
              </span>
            )}
          </div>
        )}

        {/* ── Order notes ── */}
        {order.notes && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: 6, padding: '6px 10px', marginBottom: 8,
            fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#92400E',
            display: 'flex', gap: 6, alignItems: 'flex-start',
          }}>
            <span>📝</span>
            <span>{order.notes}</span>
          </div>
        )}

        {/* ── Waiter note (set after modification) ── */}
        {(order as any).waiter_note && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 6, padding: '6px 10px', marginBottom: 8,
            fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#166534',
            display: 'flex', gap: 6, alignItems: 'flex-start',
          }}>
            <span>💬</span>
            <span><strong>You told customer:</strong> {(order as any).waiter_note}</span>
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

        {/* ── Items list ── */}
        <div style={{ marginBottom: 8 }}>
          {showItems.map(item => (
            <div key={item.id} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)' }}>
                  <span style={{ fontWeight: 600, color: typeConfig.color }}>{item.quantity}×</span>{' '}
                  {item.item_name}
                  {item.is_cancelled && (
                    <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 5, textDecoration: 'line-through' }}>cancelled</span>
                  )}
                </span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink4)', flexShrink: 0, marginLeft: 6 }}>
                  ₹{(item.unit_price * item.quantity).toFixed(0)}
                </span>
              </div>
              {/* Addons */}
              {item.addons && item.addons.length > 0 && (
                <div style={{ paddingLeft: 16, marginTop: 2 }}>
                  {item.addons.map((a, i) => (
                    <span key={i} style={{
                      fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)',
                      marginRight: 8,
                    }}>
                      + {a.addon_name}{Number(a.price) > 0 ? ` (₹${Number(a.price).toFixed(0)})` : ''}
                    </span>
                  ))}
                </div>
              )}
              {/* Item note */}
              {item.notes && (
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: '#92400E', paddingLeft: 16, marginTop: 1 }}>
                  ✏ {item.notes}
                </p>
              )}
            </div>
          ))}
          {extraCount > 0 && (
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)', marginTop: 4 }}>
              +{extraCount} more item{extraCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── Bill breakdown (GST / service charge) ── */}
        {(Number(order.cgst_amount) > 0 || Number(order.service_charge) > 0) && (
          <div style={{
            background: 'var(--paper2)', borderRadius: 6, padding: '6px 10px',
            marginBottom: 8, display: 'flex', flexWrap: 'wrap' as const, gap: '4px 14px',
          }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)' }}>
              Subtotal ₹{Number(order.subtotal).toFixed(0)}
            </span>
            {Number(order.cgst_amount) > 0 && (
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)' }}>
                GST ₹{(Number(order.cgst_amount) + Number(order.sgst_amount)).toFixed(0)}
              </span>
            )}
            {Number(order.service_charge) > 0 && (
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)' }}>
                Service ₹{Number(order.service_charge).toFixed(0)}
              </span>
            )}
          </div>
        )}

        {/* ── Timeout countdown (PENDING only) ── */}
        {isPending && (
          <TimeoutCountdown created_at={order.created_at} timeoutMin={timeoutMin} />
        )}

        <div style={{ height: 1, background: 'var(--border)', margin: '10px 0 8px' }} />

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 6 }}>
          {action && (
            <button
              onClick={() => onAction(order.id, action.status)}
              style={{
                flex: 1, padding: '9px 8px', borderRadius: 7,
                background: action.bg, color: action.color, border: action.border,
                fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              {action.label}
            </button>
          )}
          {/* Edit button — PENDING only */}
          {isPending && (
            <button
              onClick={() => onModify(order)}
              title="Modify order before confirming"
              style={{
                padding: '9px 11px', borderRadius: 7,
                background: 'var(--paper2)', color: 'var(--ink3)',
                border: '1.5px solid var(--border2)',
                fontFamily: "'Geist', sans-serif", fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              ✏ Edit
            </button>
          )}
          {canDecline && (
            <button
              onClick={() => onDecline(order.id)}
              title="Decline order"
              style={{
                padding: '9px 12px', borderRadius: 7,
                background: 'var(--red-bg)', color: 'var(--red)',
                border: '1px solid rgba(220,38,38,.15)',
                fontFamily: "'Geist', sans-serif", fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              ✕ Decline
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({ title, orders, badge, onAction, onDecline, onModify, timeoutMin }: {
  title: string;
  orders: Order[];
  badge: { bg: string; color: string };
  onAction: (id: string, status: OrderStatus) => void;
  onDecline: (id: string) => void;
  onModify: (order: Order) => void;
  timeoutMin: number;
}) {
  return (
    <div>
      <div style={{
        background: 'var(--paper2)', borderRadius: '10px 10px 0 0',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>{title}</span>
        <span style={{
          background: badge.bg, color: badge.color, fontFamily: "'Geist', sans-serif",
          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100,
        }}>{orders.length}</span>
      </div>
      <div style={{ background: 'var(--paper2)', borderRadius: '0 0 10px 10px', padding: 8, minHeight: 480 }}>
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onAction={onAction}
            onDecline={onDecline}
            onModify={onModify}
            timeoutMin={timeoutMin}
          />
        ))}
        {orders.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink5)' }}>No orders</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { restaurant } = useDashboardStore();
  const restaurantId = restaurant?.id || '';
  const timeoutMin: number = (restaurant as any)?.order_timeout_minutes ?? 10;

  const [columns, setColumns] = useState<Columns>({ PENDING: [], PREPARING: [], READY: [] });
  const [filter, setFilter] = useState('All');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [declineOrderId, setDeclineOrderId] = useState<string | null>(null);
  const [modifyingOrder, setModifyingOrder] = useState<Order | null>(null);
  const { socketRef } = useSocket(restaurantId, 'kitchen');

  // Initial load
  useEffect(() => {
    api.get('/orders').then(r => {
      const orders: Order[] = r.data;
      setColumns({
        PENDING: orders.filter(o => o.status === 'PENDING'),
        PREPARING: orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING'),
        READY: orders.filter(o => o.status === 'READY'),
      });
      setLastUpdate(new Date());
    });
  }, []);

  // Socket events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handleNew = (order: Order) => {
      setColumns(prev => ({ ...prev, PENDING: [order, ...prev.PENDING] }));
      setLastUpdate(new Date());
    };
    const handleStatus = ({ order_id, status }: { order_id: string; status: OrderStatus }) => {
      setColumns(prev => {
        const all = [...prev.PENDING, ...prev.PREPARING, ...prev.READY];
        const order = all.find(o => o.id === order_id);
        if (!order) return prev;
        const updated = { ...order, status };
        const remove = (arr: Order[]) => arr.filter(o => o.id !== order_id);
        const newCols: Columns = { PENDING: remove(prev.PENDING), PREPARING: remove(prev.PREPARING), READY: remove(prev.READY) };
        if (status === 'PENDING') newCols.PENDING = [updated, ...newCols.PENDING];
        else if (status === 'CONFIRMED' || status === 'PREPARING') newCols.PREPARING = [updated, ...newCols.PREPARING];
        else if (status === 'READY') newCols.READY = [updated, ...newCols.READY];
        // CANCELLED or other terminal states — just remove
        return newCols;
      });
      setLastUpdate(new Date());
    };
    // order:modified — update the card in-place (the full updated order is in payload.order)
    const handleModified = (payload: { order_id: string; order: Order | null }) => {
      if (!payload.order) return;
      setColumns(prev => ({
        PENDING:   prev.PENDING.map(o => o.id === payload.order_id ? payload.order! : o),
        PREPARING: prev.PREPARING.map(o => o.id === payload.order_id ? payload.order! : o),
        READY:     prev.READY.map(o => o.id === payload.order_id ? payload.order! : o),
      }));
      setLastUpdate(new Date());
    };

    socket.on('order:new', handleNew);
    socket.on('order:status', handleStatus);
    socket.on('order:modified', handleModified);
    return () => {
      socket.off('order:new', handleNew);
      socket.off('order:status', handleStatus);
      socket.off('order:modified', handleModified);
    };
  }, [socketRef.current]);

  // Seconds ago ticker
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdate.getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  const handleAction = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    // Optimistic update — move card instantly, no spinner
    setColumns(prev => {
      const all = [...prev.PENDING, ...prev.PREPARING, ...prev.READY];
      const order = all.find(o => o.id === orderId);
      if (!order) return prev;
      const updated = { ...order, status: newStatus };
      const remove = (arr: Order[]) => arr.filter(o => o.id !== orderId);
      const newCols: Columns = { PENDING: remove(prev.PENDING), PREPARING: remove(prev.PREPARING), READY: remove(prev.READY) };
      if (newStatus === 'CONFIRMED' || newStatus === 'PREPARING') newCols.PREPARING = [updated, ...newCols.PREPARING];
      else if (newStatus === 'READY') newCols.READY = [updated, ...newCols.READY];
      return newCols;
    });
    setLastUpdate(new Date());

    // Persist to server in background
    api.patch(`/orders/${orderId}/status`, { status: newStatus }).catch(err => {
      console.error('Status update failed, refetching', err);
      api.get('/orders').then(r => {
        const orders: Order[] = r.data;
        setColumns({
          PENDING: orders.filter(o => o.status === 'PENDING'),
          PREPARING: orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING'),
          READY: orders.filter(o => o.status === 'READY'),
        });
      });
    });
  }, []);

  const handleDeclineConfirm = useCallback(async (orderId: string, reason: string) => {
    // Optimistic: remove from UI immediately — no waiting for the server
    setColumns(prev => ({
      PENDING: prev.PENDING.filter(o => o.id !== orderId),
      PREPARING: prev.PREPARING.filter(o => o.id !== orderId),
      READY: prev.READY.filter(o => o.id !== orderId),
    }));
    setDeclineOrderId(null);
    setLastUpdate(new Date());

    // Fire API in background — if it fails the WebSocket event will correct state
    api.post(`/orders/${orderId}/decline`, { reason }).catch(err => {
      console.error('Decline failed, refetching orders', err);
      api.get('/orders').then(r => {
        const orders: Order[] = r.data;
        setColumns({
          PENDING: orders.filter(o => o.status === 'PENDING'),
          PREPARING: orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING'),
          READY: orders.filter(o => o.status === 'READY'),
        });
      });
    });
  }, []);

  const handleModifySaved = useCallback((updatedOrder: Order) => {
    setColumns(prev => ({
      PENDING:   prev.PENDING.map(o => o.id === updatedOrder.id ? updatedOrder : o),
      PREPARING: prev.PREPARING.map(o => o.id === updatedOrder.id ? updatedOrder : o),
      READY:     prev.READY.map(o => o.id === updatedOrder.id ? updatedOrder : o),
    }));
    setLastUpdate(new Date());
  }, []);

  const filterPills = ['All', 'Dine-in', 'Room service', 'Takeaway'];

  return (
    <>
      <style>{`@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Decline modal */}
      {declineOrderId && (
        <DeclineModal
          orderId={declineOrderId}
          onDecline={handleDeclineConfirm}
          onCancel={() => setDeclineOrderId(null)}
        />
      )}

      {/* Modify order modal */}
      {modifyingOrder && (
        <ModifyOrderModal
          order={modifyingOrder}
          onClose={() => setModifyingOrder(null)}
          onSaved={handleModifySaved}
        />
      )}

      {/* Header */}
      <div style={{ padding: '28px 28px 0', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 26, color: 'var(--ink)' }}>Live orders</h1>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)', marginTop: 2 }}>
            Auto-cancel pending orders after <strong>{timeoutMin} min</strong>
            {' '}·{' '}
            <a href="/dashboard/settings" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Change in settings →</a>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse2 1.5s infinite' }} />
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink4)' }}>
              Live · updated {secondsAgo}s ago
            </span>
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {filterPills.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', borderRadius: 100, border: '1.5px solid',
                borderColor: filter === f ? 'transparent' : 'var(--border2)',
                background: filter === f ? 'var(--ink)' : 'transparent',
                color: filter === f ? '#fff' : 'var(--ink3)',
                fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer',
              }}>
                {f}
              </button>
            ))}
          </div>

          <button style={{
            padding: '7px 14px', border: '1.5px solid var(--border2)', borderRadius: 8,
            background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 13,
            color: 'var(--ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            🖨 Print all KOT
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <KanbanColumn
          title="Pending"
          orders={columns.PENDING}
          badge={{ bg: 'var(--amber-bg)', color: 'var(--amber)' }}
          onAction={handleAction}
          onDecline={setDeclineOrderId}
          onModify={setModifyingOrder}
          timeoutMin={timeoutMin}
        />
        <KanbanColumn
          title="Preparing"
          orders={columns.PREPARING}
          badge={{ bg: 'var(--blue-bg)', color: 'var(--blue)' }}
          onAction={handleAction}
          onDecline={setDeclineOrderId}
          onModify={setModifyingOrder}
          timeoutMin={timeoutMin}
        />
        <KanbanColumn
          title="Ready"
          orders={columns.READY}
          badge={{ bg: 'var(--green-bg)', color: 'var(--green)' }}
          onAction={handleAction}
          onDecline={setDeclineOrderId}
          onModify={setModifyingOrder}
          timeoutMin={timeoutMin}
        />
      </div>
    </>
  );
}
