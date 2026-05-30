'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TableStatus, PaymentMethod } from '@dineflow/types';
import { formatINR } from '@dineflow/utils';
import { RestaurantTable } from './useTablesQR';
import { api } from '@/lib/api';
import { Order } from '@dineflow/types';
import { useToast } from '@/components/ui/Toast';

interface TablePopoverProps {
  table: RestaurantTable;
  anchorRect: DOMRect;
  onClose: () => void;
  onStatusChanged: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: PaymentMethod.UPI, label: 'UPI' },
  { value: PaymentMethod.CASH, label: 'Cash' },
  { value: PaymentMethod.CARD, label: 'Card' },
  { value: PaymentMethod.ONLINE, label: 'Online' },
  { value: PaymentMethod.COMPLIMENTARY, label: 'Complimentary' },
];

export default function TablePopover({
  table,
  anchorRect,
  onClose,
  onStatusChanged,
}: TablePopoverProps) {
  const { showToast } = useToast();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<Order | null | undefined>(undefined); // undefined = loading
  const [billId, setBillId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.UPI,
  );
  const [loading, setLoading] = useState(false);

  // Fetch active order
  useEffect(() => {
    if (!table.current_order_id) {
      setOrder(null);
      return;
    }
    api
      .get('/orders', {
        params: { tableId: table.id, status: 'active' },
      })
      .then((r) => {
        const orders: Order[] = r.data;
        setOrder(orders[0] ?? null);
      })
      .catch(() => setOrder(null));
  }, [table.id, table.current_order_id]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Viewport-aware positioning
  const style = useCallback((): React.CSSProperties => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const popW = 320;
    const popH = 380;
    let left = anchorRect.right + 8;
    let top = anchorRect.top;

    if (left + popW > W - 8) left = anchorRect.left - popW - 8;
    if (top + popH > H - 8) top = H - popH - 8;
    if (top < 8) top = 8;

    return {
      position: 'fixed',
      left,
      top,
      width: popW,
      zIndex: 100,
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.12)',
      padding: 20,
    };
  }, [anchorRect]);

  async function handleGenerateBill() {
    if (!order) return;
    setLoading(true);
    try {
      const r = await api.post(`/billing/generate/${order.id}`);
      setBillId(r.data?.id ?? r.data?.bill_id ?? r.data);
      showToast({ type: 'success', title: 'Bill generated' });
    } catch {
      showToast({ type: 'error', title: 'Failed to generate bill' });
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid() {
    if (!order && !billId) return;
    setLoading(true);
    try {
      const id = billId ?? order?.id;
      await api.post(`/billing/${id}/payment`, { method: paymentMethod });
      showToast({ type: 'success', title: 'Payment recorded', message: `Paid via ${paymentMethod}` });
      onStatusChanged();
      onClose();
    } catch {
      showToast({ type: 'error', title: 'Failed to record payment' });
    } finally {
      setLoading(false);
    }
  }

  const elapsedMin = table.occupied_since
    ? Math.floor(
        (Date.now() - new Date(table.occupied_since).getTime()) / 60000,
      )
    : 0;

  const isBillRequested = table.status === TableStatus.BILL_REQUESTED;
  const isOccupied = table.status === TableStatus.OCCUPIED;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          background: 'transparent',
        }}
        onClick={onClose}
      />

      <div ref={popoverRef} style={style()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'Geist', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--ink)',
                marginBottom: 2,
              }}
            >
              {table.name}
            </p>
            <p
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                color: 'var(--ink4)',
              }}
            >
              {table.status.replace('_', ' ')}
              {elapsedMin > 0 && ` · ${elapsedMin}m ago`}
              {table.covers ? ` · ${table.covers} guests` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--ink4)',
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border)',
            marginBottom: 14,
          }}
        />

        {/* Order loading */}
        {order === undefined && (
          <p
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              color: 'var(--ink4)',
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            Loading order…
          </p>
        )}

        {/* No active order */}
        {order === null && (
          <p
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              color: 'var(--ink4)',
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            No active order for this table.
          </p>
        )}

        {/* Order summary */}
        {order != null && (
          <>
            <p
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: 'var(--ink4)',
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              Order #{order.id.slice(-6).toUpperCase()}
            </p>

            {/* Items */}
            <div
              style={{
                maxHeight: 160,
                overflowY: 'auto',
                marginBottom: 12,
              }}
            >
              {order.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Geist', sans-serif",
                      fontSize: 12,
                      color: 'var(--ink)',
                      flex: 1,
                      opacity: item.is_cancelled ? 0.4 : 1,
                      textDecoration: item.is_cancelled ? 'line-through' : 'none',
                    }}
                  >
                    {item.quantity}× {item.item_name}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 12,
                      color: 'var(--ink3)',
                      flexShrink: 0,
                    }}
                  >
                    {formatINR(item.total_price)}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: '1px solid var(--border)',
                padding: '8px 0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 12,
                    color: 'var(--ink4)',
                  }}
                >
                  Subtotal
                </span>
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 12,
                    color: 'var(--ink4)',
                  }}
                >
                  {formatINR(order.subtotal)}
                </span>
              </div>
              {(order.cgst_amount > 0 || order.sgst_amount > 0) && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Geist', sans-serif",
                      fontSize: 12,
                      color: 'var(--ink4)',
                    }}
                  >
                    GST
                  </span>
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 12,
                      color: 'var(--ink4)',
                    }}
                  >
                    {formatINR(order.cgst_amount + order.sgst_amount)}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Geist', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--ink)',
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--ink)',
                  }}
                >
                  {formatINR(order.total_amount)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Payment method selector (bill requested) */}
        {isBillRequested && order != null && (
          <div style={{ marginBottom: 12 }}>
            <p
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 11,
                color: 'var(--ink4)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              Payment method
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPaymentMethod(value)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 100,
                    fontSize: 11,
                    fontFamily: "'Geist', sans-serif",
                    cursor: 'pointer',
                    background:
                      paymentMethod === value
                        ? 'var(--ink)'
                        : 'transparent',
                    color:
                      paymentMethod === value ? '#fff' : 'var(--ink3)',
                    border:
                      paymentMethod === value
                        ? '1px solid var(--ink)'
                        : '1px solid var(--border)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {isOccupied && order != null && !billId && (
            <button
              onClick={handleGenerateBill}
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'var(--ink)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: "'Geist', sans-serif",
                fontWeight: 500,
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Generating…' : 'Generate bill'}
            </button>
          )}

          {isBillRequested && order != null && (
            <button
              onClick={handleMarkPaid}
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'var(--green)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: "'Geist', sans-serif",
                fontWeight: 500,
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Processing…' : 'Mark as paid'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
