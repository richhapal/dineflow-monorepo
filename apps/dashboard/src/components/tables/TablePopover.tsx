'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { formatINR } from '@dineflow/utils';
import { RestaurantTable } from './useTablesQR';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface TablePopoverProps {
  table: RestaurantTable;
  anchorRect: DOMRect;
  onClose: () => void;
  onStatusChanged: () => void;
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_cancelled: boolean;
}

interface TableSession {
  session_qr_slug: string;
  status: string;
}

interface TableOrder {
  id: string;
  order_number?: number | null;
  status: string;
  customer_name?: string | null;
  covers: number;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  service_charge: number;
  total_amount: number;
  items: OrderItem[];
  created_at: string;
  tableSession?: TableSession | null;
}

const PAYMENT_METHODS = [
  { value: 'CASH',          label: '💵 Cash' },
  { value: 'UPI',           label: '📱 UPI' },
  { value: 'CARD',          label: '💳 Card' },
  { value: 'COMPLIMENTARY', label: '🎁 Comp' },
];

export default function TablePopover({
  table,
  anchorRect,
  onClose,
  onStatusChanged,
}: TablePopoverProps) {
  const { showToast } = useToast();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [orders, setOrders] = useState<TableOrder[] | null | undefined>(undefined); // undefined=loading
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ totalAmount: number; orderCount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Fetch all non-completed orders for this table ──────────────────────────
  const fetchOrders = useCallback(() => {
    setOrders(undefined);
    api.get('/orders', { params: { tableId: table.id } })
      .then(r => {
        const all: TableOrder[] = r.data;
        // Show SERVED orders (ready to bill) + any still in progress
        setOrders(all.length ? all : null);
      })
      .catch(() => setOrders(null));
  }, [table.id]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Viewport-aware position ────────────────────────────────────────────────
  const popStyle = useCallback((): React.CSSProperties => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const popW = 340;
    const popH = 520;
    let left = anchorRect.right + 10;
    let top  = anchorRect.top;
    if (left + popW > W - 8) left = anchorRect.left - popW - 10;
    if (top + popH > H - 8) top  = H - popH - 8;
    if (top < 8) top = 8;
    return {
      position: 'fixed', left, top, width: popW, zIndex: 100,
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.14)',
      overflow: 'hidden',
    };
  }, [anchorRect]);

  // ── Computed totals ────────────────────────────────────────────────────────
  const servedOrders = orders?.filter(o => ['SERVED', 'COMPLETED'].includes(o.status)) ?? [];
  const inProgressOrders = orders?.filter(o => !['SERVED', 'COMPLETED', 'CANCELLED'].includes(o.status)) ?? [];

  // Group session QR — derived from first order that has a tableSession
  const sessionSlug = orders?.find(o => o.tableSession?.session_qr_slug)?.tableSession?.session_qr_slug ?? null;
  const sessionUrl = sessionSlug ? `http://localhost:3001/m/session/${sessionSlug}` : null;

  const combinedTotal    = servedOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const combinedSubtotal = servedOrders.reduce((s, o) => s + Number(o.subtotal), 0);
  const combinedGST      = servedOrders.reduce((s, o) => s + Number(o.cgst_amount) + Number(o.sgst_amount), 0);
  const combinedService  = servedOrders.reduce((s, o) => s + Number(o.service_charge), 0);
  const totalItems       = servedOrders.reduce((s, o) => s + o.items.filter(i => !i.is_cancelled).length, 0);

  const canBill = servedOrders.length > 0 && !done;

  const elapsedMin = table.occupied_since
    ? Math.floor((Date.now() - new Date(table.occupied_since).getTime()) / 60000)
    : 0;

  // ── Checkout: generate bills + record payment + complete orders ─────────────
  async function handleCheckout() {
    setLoading(true);
    try {
      const r = await api.post(`/billing/checkout-table/${table.id}`, {
        payment_method: paymentMethod,
      });
      setDone({ totalAmount: r.data.totalAmount ?? r.data.bill?.total_amount, orderCount: r.data.orderCount });
      showToast({ type: 'success', title: `Bill paid · ${formatINR(r.data.totalAmount)}` });
      onStatusChanged(); // refresh table grid
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Checkout failed';
      showToast({ type: 'error', title: msg });
    } finally {
      setLoading(false);
    }
  }

  const sans  = "'Geist', sans-serif";
  const mono  = "'Geist Mono', monospace";
  const serif = "'Instrument Serif', serif";

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={onClose} />

      <div ref={popoverRef} style={popStyle()}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px 12px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <p style={{ fontFamily: sans, fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>
              {table.name}
            </p>
            <p style={{ fontFamily: sans, fontSize: 12, color: 'var(--ink4)' }}>
              {table.status.replace(/_/g, ' ')}
              {elapsedMin > 0 && ` · ${elapsedMin}m`}
              {table.covers ? ` · ${table.covers} guests` : ''}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--ink4)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {/* ── Permanent Table QR (always visible — print on table tent card) ── */}
        {!done && (() => {
          const tableUrl = `${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001'}/m/table/${table.id}`;
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=96x96&margin=4&data=${encodeURIComponent(tableUrl)}`;
          return (
            <div style={{
              margin: '12px 18px 0',
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* QR image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="Table QR" width={72} height={72} style={{ borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Scan to Order
                </p>
                <p style={{ fontFamily: mono, fontSize: 9, color: '#9ca3af', wordBreak: 'break-all', marginBottom: 6 }}>
                  /m/table/{table.id.slice(-8)}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tableUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    style={{
                      fontFamily: sans, fontSize: 10, fontWeight: 600, padding: '4px 8px',
                      borderRadius: 5, border: '1px solid #E2E8F0',
                      background: copied ? '#111' : '#fff',
                      color: copied ? '#fff' : '#374151', cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy Link'}
                  </button>
                  {sessionUrl && (
                    <span style={{ fontFamily: sans, fontSize: 10, color: '#22C55E', padding: '4px 0', fontWeight: 600 }}>
                      ● Session active
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Success state ── */}
        {done && (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
            <p style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>
              Payment Collected!
            </p>
            <p style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
              {formatINR(done.totalAmount)}
            </p>
            <p style={{ fontFamily: sans, fontSize: 12, color: 'var(--ink4)', marginBottom: 24 }}>
              {done.orderCount} order{done.orderCount !== 1 ? 's' : ''} billed · via {
                PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label ?? paymentMethod
              }
            </p>
            <button
              onClick={onClose}
              style={{
                fontFamily: sans, padding: '10px 28px', borderRadius: 8,
                background: 'var(--ink)', color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {!done && orders === undefined && (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: sans, fontSize: 13, color: 'var(--ink4)' }}>Loading orders…</p>
          </div>
        )}

        {/* ── No orders ── */}
        {!done && orders === null && (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: sans, fontSize: 13, color: 'var(--ink4)' }}>No active orders at this table.</p>
          </div>
        )}

        {/* ── Orders view ── */}
        {!done && orders && orders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 480, overflowY: 'auto' }}>

            {/* In-progress orders notice */}
            {inProgressOrders.length > 0 && (
              <div style={{
                margin: '12px 18px 0',
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 8, padding: '8px 12px',
              }}>
                <p style={{ fontFamily: sans, fontSize: 12, color: '#92400E' }}>
                  ⏳ {inProgressOrders.length} order{inProgressOrders.length !== 1 ? 's' : ''} still in progress
                  ({inProgressOrders.map(o => o.status).join(', ')})
                </p>
              </div>
            )}

            {/* Each served order */}
            {servedOrders.map((order, idx) => (
              <div key={order.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                    #{String(order.order_number ?? (idx + 1)).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontFamily: sans, fontSize: 11, padding: '2px 8px', borderRadius: 100,
                    background: '#F0FDF4', color: '#15803D', fontWeight: 500,
                  }}>
                    SERVED
                  </span>
                </div>

                {/* Items */}
                <div style={{ marginBottom: 8 }}>
                  {order.items.filter(i => !i.is_cancelled).map(item => (
                    <div key={item.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '3px 0',
                    }}>
                      <span style={{ fontFamily: sans, fontSize: 12, color: 'var(--ink3)' }}>
                        {item.quantity}× {item.item_name}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--ink4)' }}>
                        {formatINR(Number(item.total_price))}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Order subtotal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                  <span style={{ fontFamily: sans, fontSize: 12, color: 'var(--ink4)' }}>
                    Subtotal {Number(order.cgst_amount) > 0 && `+ GST`}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                    {formatINR(Number(order.total_amount))}
                  </span>
                </div>
              </div>
            ))}

            {/* Combined bill summary */}
            {servedOrders.length > 0 && (
              <div style={{ padding: '14px 18px', background: 'var(--paper2)', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  Bill Summary · {totalItems} item{totalItems !== 1 ? 's' : ''}
                </p>
                {[
                  { label: 'Subtotal',       value: combinedSubtotal,  show: true },
                  { label: 'GST',            value: combinedGST,       show: combinedGST > 0 },
                  { label: 'Service charge', value: combinedService,   show: combinedService > 0 },
                ].filter(r => r.show).map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: sans, fontSize: 12, color: 'var(--ink4)' }}>{row.label}</span>
                    <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--ink4)' }}>{formatINR(row.value)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Total</span>
                  <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                    {formatINR(combinedTotal)}
                  </span>
                </div>
              </div>
            )}

            {/* Payment method + Checkout */}
            {canBill && (
              <div style={{ padding: '14px 18px' }}>
                <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                  Payment method
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {PAYMENT_METHODS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12,
                        fontFamily: sans, cursor: 'pointer',
                        background: paymentMethod === value ? 'var(--ink)' : 'transparent',
                        color: paymentMethod === value ? '#fff' : 'var(--ink3)',
                        border: paymentMethod === value ? '1.5px solid var(--ink)' : '1.5px solid var(--border)',
                        fontWeight: paymentMethod === value ? 600 : 400,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10,
                    background: loading ? 'var(--ink3)' : 'var(--ink)',
                    color: '#fff', border: 'none',
                    fontFamily: sans, fontWeight: 700, fontSize: 14,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {loading
                    ? 'Processing…'
                    : `🧾 Generate Bill & Collect ${formatINR(combinedTotal)}`
                  }
                </button>

                {servedOrders.length > 1 && (
                  <p style={{ fontFamily: sans, fontSize: 11, color: 'var(--ink4)', textAlign: 'center', marginTop: 6 }}>
                    Covers {servedOrders.length} orders in one invoice
                  </p>
                )}
              </div>
            )}

            {/* No served orders — all still in progress */}
            {servedOrders.length === 0 && inProgressOrders.length > 0 && (
              <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                <p style={{ fontFamily: sans, fontSize: 13, color: 'var(--ink4)' }}>
                  Orders are still being prepared — bill can be generated once they are served.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
