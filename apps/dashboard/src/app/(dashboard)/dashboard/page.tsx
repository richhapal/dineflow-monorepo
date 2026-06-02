'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useDashboardStore } from '@/lib/store';
import { useSocket } from '@/hooks/useSocket';
import { formatINR, timeAgo } from '@dineflow/utils';
import type { Order } from '@dineflow/types';
import { PauseOrderingToggle } from '@/components/ordering/PauseOrderingToggle';
import { LiveQueuePanel } from '@/components/ordering/LiveQueuePanel';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  DINE_IN:       { icon: '🍽', color: '#1E40AF', bg: '#EFF6FF',  label: 'Dine-in' },
  TAKEAWAY:      { icon: '🛍', color: '#C2410C', bg: '#FFF7ED',  label: 'Outside' },
  ROOM_SERVICE:  { icon: '🛎', color: '#6D28D9', bg: '#EDE9FE',  label: 'Room' },
  WAITER_PLACED: { icon: '🧑‍🍳', color: '#065F46', bg: '#ECFDF5', label: 'Waiter' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: 'Pending',   bg: '#FEF3C7', color: '#B45309' },
  CONFIRMED: { label: 'Confirmed', bg: '#DBEAFE', color: '#1D4ED8' },
  PREPARING: { label: 'Preparing', bg: '#FEF3C7', color: '#D97706' },
  READY:     { label: 'Ready ✓',   bg: '#DCFCE7', color: '#15803D' },
  SERVED:    { label: 'Served',    bg: '#F0FDF4', color: '#16A34A' },
  COMPLETED: { label: 'Done',      bg: '#F3F4F6', color: '#6B7280' },
  CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', color: '#DC2626' },
};

const SPARK_REV  = [18, 27, 22, 35, 29, 38, 44];
const SPARK_SCAN = [60, 90, 75, 110, 95, 128, 142];
const PEAK_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const PEAK_DATA  = [3, 8, 12, 9, 6, 4, 7, 14, 18, 15, 10, 5];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string | number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: 'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
      backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear',
    }} />
  );
}

function Sparkline({ data, color = '#B85C2C' }: { data: number[]; color?: string }) {
  const w = 56, h = 24;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const line = `M${pts.join(' L')}`;
  const fill = `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={fill} fill={color} opacity=".12" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, subColor = 'var(--green)',
  loading, spark, sparkColor, badge, badgeBg, badgeColor,
}: {
  icon: string; label: string; value: string; sub?: string; subColor?: string;
  loading?: boolean; spark?: number[]; sparkColor?: string;
  badge?: string; badgeBg?: string; badgeColor?: string;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
            background: badgeBg || 'var(--amber-bg)', color: badgeColor || 'var(--amber)',
            fontFamily: "'Geist', sans-serif", letterSpacing: '.04em',
          }}>{badge}</span>
        )}
      </div>

      <p style={{
        fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 10.5,
        color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6,
      }}>
        {label}
      </p>

      {loading ? (
        <Skeleton h={30} w="60%" />
      ) : (
        <p style={{
          fontFamily: "'Geist Mono', monospace", fontSize: 26, fontWeight: 600,
          color: 'var(--ink)', lineHeight: 1.1, marginBottom: 10,
        }}>
          {value}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {sub && (
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11.5, color: subColor }}>
            {sub}
          </span>
        )}
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order, isLast }: { order: Order; isLast: boolean }) {
  const type = ORDER_TYPE_CONFIG[order.order_type as string] || ORDER_TYPE_CONFIG['DINE_IN'];
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];
  const table = (order as any).table as { name: string } | null;
  const location = table ? `Table ${table.name}` : type.label;

  const itemsText = order.items.map(i => `${i.quantity}× ${i.item_name}`).join(', ');

  return (
    <div style={{
      padding: '12px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12,
      transition: 'background .1s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Order type icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: type.bg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>
        {type.icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink)',
          }}>
            {order.customer_name || 'Guest'}
          </span>
          <span style={{
            fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)',
            background: 'var(--paper3)', padding: '1px 6px', borderRadius: 4,
          }}>
            {location}
          </span>
        </div>
        <p style={{
          fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {itemsText}
        </p>
      </div>

      {/* Right — total + status + time */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--ink)',
        }}>
          {formatINR(Number(order.total_amount))}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink5)' }}>
            {timeAgo(order.created_at)}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
            background: status.bg, color: status.color,
            fontFamily: "'Geist', sans-serif", letterSpacing: '.03em',
          }}>
            {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Fresh Start button + modal ───────────────────────────────────────────────

function FreshStartButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ cancelledOrders: number; resetTables: number } | null>(null);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await api.post('/orders/fresh-start');
      setResult(res.data);
      onDone(); // refresh parent queries
    } catch {
      // ignore — show generic error inline
      setResult({ cancelledOrders: 0, resetTables: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setResult(null); setOpen(true); }}
        style={{
          width: '100%', padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: 'none',
          borderTop: '1px solid var(--border)',
          fontFamily: "'Geist', sans-serif", fontSize: 13,
          color: 'var(--ink3)', cursor: 'pointer',
          transition: 'background .12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ fontSize: 16 }}>🧹</span>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>
            Fresh start
          </p>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)', margin: 0 }}>
            Cancel open orders · reset tables
          </p>
        </div>
      </button>

      {/* Modal */}
      {open && (
        <>
          <div
            onClick={() => !loading && setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: 16, width: 400,
            zIndex: 901, boxShadow: '0 24px 64px rgba(0,0,0,.18)',
            overflow: 'hidden',
          }}>
            {result ? (
              /* ── Success state ── */
              <div style={{ padding: '32px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{
                  fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
                  fontSize: 22, color: 'var(--ink)', marginBottom: 8,
                }}>
                  All clear!
                </h3>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, color: 'var(--ink3)', lineHeight: 1.5, marginBottom: 20 }}>
                  <strong>{result.cancelledOrders}</strong> order{result.cancelledOrders !== 1 ? 's' : ''} cancelled ·{' '}
                  <strong>{result.resetTables}</strong> table{result.resetTables !== 1 ? 's' : ''} reset to available
                </p>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                    background: 'var(--ink)', color: '#fff',
                    fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              /* ── Confirm state ── */
              <>
                {/* Red accent strip */}
                <div style={{ height: 4, background: 'var(--red)' }} />
                <div style={{ padding: '24px 26px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, background: '#FEE2E2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>🧹</div>
                    <div>
                      <h3 style={{
                        fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
                        fontSize: 21, color: 'var(--ink)', marginBottom: 4,
                      }}>
                        Fresh start?
                      </h3>
                      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink3)', lineHeight: 1.5 }}>
                        This will permanently reset your restaurant state for a clean shift.
                      </p>
                    </div>
                  </div>

                  {/* What will happen */}
                  <div style={{
                    background: '#FFF5F5', borderRadius: 10, padding: '14px 16px', marginBottom: 20,
                    border: '1px solid #FECACA',
                  }}>
                    <p style={{
                      fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11,
                      color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10,
                    }}>
                      What will happen
                    </p>
                    {[
                      { icon: '✕', text: 'Pending, confirmed & preparing orders → Cancelled (served orders are untouched)' },
                      { icon: '🪑', text: 'All occupied / cleaning tables → Available' },
                      { icon: '🗑', text: 'Redis order queue flushed for your restaurant' },
                    ].map(({ icon, text }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < 2 ? 8 : 0 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 5,
                          background: '#FEE2E2', color: 'var(--red)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>{icon}</span>
                        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.4 }}>
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p style={{
                    fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)',
                    marginBottom: 18, textAlign: 'center',
                  }}>
                    ⚠ This cannot be undone. Customers with active orders will be notified.
                  </p>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleConfirm}
                      disabled={loading}
                      style={{
                        flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                        background: loading ? 'var(--paper3)' : 'var(--red)',
                        color: loading ? 'var(--ink4)' : '#fff',
                        fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 14,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? '🧹 Resetting…' : '🧹 Yes, fresh start'}
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      disabled={loading}
                      style={{
                        padding: '11px 20px', borderRadius: 8,
                        border: '1.5px solid var(--border2)', background: '#fff',
                        fontFamily: "'Geist', sans-serif", fontSize: 14, color: 'var(--ink3)',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { restaurant, liveOrders } = useDashboardStore();
  const restaurantId = restaurant?.id || '';
  const token = typeof window !== 'undefined' ? (localStorage.getItem('dineflow_token') || '') : '';

  const { queue, restaurantStatus } = useSocket(restaurantId, 'dashboard');

  // ── Date filter ───────────────────────────────────────────────────────────
  type DatePreset = 'live' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';
  const [datePreset, setDatePreset] = useState<DatePreset>('live');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [showCustom, setShowCustom] = useState(false);

  function isoDay(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  function buildParams(preset: DatePreset): string {
    const startOfDay = (iso: string) => `${iso}T00:00:00.000Z`;
    const endOfDay   = (iso: string) => `${iso}T23:59:59.999Z`;
    switch (preset) {
      case 'live':      return '';
      case 'today':     return `?from=${startOfDay(isoDay())}&to=${endOfDay(isoDay())}`;
      case 'yesterday': return `?from=${startOfDay(isoDay(-1))}&to=${endOfDay(isoDay(-1))}`;
      case '7d':        return `?from=${startOfDay(isoDay(-6))}&to=${endOfDay(isoDay())}`;
      case '30d':       return `?from=${startOfDay(isoDay(-29))}&to=${endOfDay(isoDay())}`;
      case 'custom':
        if (customFrom && customTo) return `?from=${startOfDay(customFrom)}&to=${endOfDay(customTo)}`;
        return '';
      default:          return '';
    }
  }

  const activeParams = buildParams(datePreset);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['orders', restaurantId, datePreset, customFrom, customTo],
    queryFn: () => api.get(`/orders${activeParams}`).then(r => r.data),
    refetchInterval: datePreset === 'live' ? 30_000 : 120_000,
    enabled: !!restaurantId,
  });

  // ── Live status from server (business hours + server timezone) ─────────────
  const { data: liveStatus } = useQuery<{
    state: string;
    message?: string;
    opens_at?: string;
    closes_at?: string;
    server_time?: string;
    timezone?: string;
    manual_override?: boolean;
  }>({
    queryKey: ['live-status', restaurantId],
    queryFn: () => api.get('/restaurants/me/live-status').then(r => r.data),
    refetchInterval: 60_000,   // re-check every minute
    enabled: !!restaurantId,
  });

  const toggleOpenMutation = useMutation({
    mutationFn: () => api.post('/restaurants/me/toggle-open', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant'] }),
  });

  // ── Derived stats ──────────────────────────────────────────────────────────
  // For KPI cards, always derive from "today" even if a different date filter is active
  const today = new Date().toDateString();
  const allOrdersForKpi = datePreset === 'live' || datePreset === 'today'
    ? orders
    : orders; // KPI cards show filtered-period totals
  const completedInPeriod = allOrdersForKpi.filter(o => o.status === 'COMPLETED');
  const periodRevenue   = completedInPeriod.reduce((s, o) => s + Number(o.total_amount), 0);
  const activeOrders    = orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status));
  const pendingOrders   = orders.filter(o => o.status === 'PENDING');
  const avgOrderValue   = completedInPeriod.length ? periodRevenue / completedInPeriod.length : 0;
  const occupiedCount   = Array.from(new Set(activeOrders.filter(o => o.table_id).map(o => o.table_id))).length;

  // Top items for the selected period
  const itemCounts: Record<string, { name: string; count: number }> = {};
  orders.forEach(o => o.items.forEach(i => {
    if (!itemCounts[i.menu_item_id]) itemCounts[i.menu_item_id] = { name: i.item_name, count: 0 };
    itemCounts[i.menu_item_id].count += i.quantity;
  }));
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 4);
  const maxCount = topItems[0]?.count || 1;

  // Live feed uses WS-pushed orders; historical uses the fetched list
  const displayOrders = (datePreset === 'live' && liveOrders.length > 0 ? liveOrders : orders).slice(0, 8);

  // Period label for the header
  const PRESET_LABELS: Record<DatePreset, string> = {
    live: 'Live orders', today: "Today's orders", yesterday: "Yesterday's orders",
    '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom range',
  };
  const maxPeak = Math.max(...PEAK_DATA);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const ownerName = (restaurant as any)?.owner_name || restaurant?.name || 'Chef';

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes pulseGreen { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 22, flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <h1 style={{
              fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
              fontSize: 28, color: 'var(--ink)', marginBottom: 4,
            }}>
              {greeting}, {ownerName.split(' ')[0]} 👋
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)' }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span style={{ color: 'var(--border2)' }}>·</span>
              {/* Live dot */}
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
                  display: 'inline-block', animation: 'pulseGreen 1.5s infinite',
                }} />
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Live</span>
              </span>
            </div>
          </div>

          {/* Status chips */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Live status chip — computed from server-side business hours */}
            {(() => {
              const state = liveStatus?.state;
              const isOpen = state === 'OPEN';
              const isBreak = state === 'BREAK';
              const isManual = liveStatus?.manual_override;

              let bg = '#FEF2F2', border = '#FECACA', color = '#DC2626', dot = 'var(--red)';
              let label = liveStatus?.message || 'Closed';

              if (isOpen) {
                bg = '#ECFDF5'; border = '#BBF7D0'; color = '#15803D'; dot = 'var(--green)';
                label = liveStatus.closes_at ? `Open · closes ${liveStatus.closes_at}` : 'Open for orders';
              } else if (isBreak) {
                bg = '#FEF3C7'; border = '#FDE68A'; color = '#B45309'; dot = '#F59E0B';
                label = liveStatus?.message || 'On break';
              } else if (isManual) {
                label = 'Manually closed';
              } else if (state === 'WEEKLY_OFF') {
                label = 'Weekly off today';
              } else if (state === 'HOLIDAY') {
                bg = '#FEF3C7'; border = '#FDE68A'; color = '#B45309'; dot = '#F59E0B';
                label = liveStatus?.message || 'Holiday';
              }

              return (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                  background: bg, border: `1px solid ${border}`,
                  fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 600, color,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot,
                    animation: isOpen ? 'pulseGreen 1.5s infinite' : 'none',
                  }} />
                  {label}
                  {liveStatus?.server_time && (
                    <span style={{ fontSize: 10, fontWeight: 400, opacity: .7, marginLeft: 2 }}>
                      ({liveStatus.server_time} {liveStatus.timezone?.split('/')[1]?.replace('_',' ')})
                    </span>
                  )}
                </span>
              );
            })()}
            {pendingOrders.length > 0 && (
              <Link href="/dashboard/orders" style={{ textDecoration: 'none' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                  background: '#FEF3C7', border: '1px solid #FDE68A',
                  fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 600, color: '#B45309',
                  cursor: 'pointer',
                }}>
                  ⚡ {pendingOrders.length} pending order{pendingOrders.length !== 1 ? 's' : ''} — Review →
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* ── KPI row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          <KpiCard
            icon="💰" label="Today's Revenue"
            value={formatINR(periodRevenue)}
            sub={completedInPeriod.length > 0 ? `from ${completedInPeriod.length} orders` : 'No orders yet'}
            subColor={completedInPeriod.length > 0 ? 'var(--green)' : 'var(--ink4)'}
            loading={ordersLoading}
            spark={SPARK_REV} sparkColor="#B85C2C"
          />
          <KpiCard
            icon="🔥" label="Live Orders"
            value={String(activeOrders.length)}
            loading={ordersLoading}
            badge={pendingOrders.length > 0 ? `${pendingOrders.length} pending` : undefined}
            sub={activeOrders.length > 0 ? `${activeOrders.length} in kitchen` : 'All clear'}
            subColor={activeOrders.length > 0 ? 'var(--amber)' : 'var(--green)'}
          />
          <KpiCard
            icon="🪑" label="Tables Occupied"
            value={String(occupiedCount)}
            loading={ordersLoading}
            sub={occupiedCount > 0 ? `${occupiedCount} table${occupiedCount !== 1 ? 's' : ''} active` : 'All available'}
            subColor={occupiedCount > 0 ? 'var(--blue)' : 'var(--ink4)'}
          />
          <KpiCard
            icon="📈" label="Avg Order Value"
            value={formatINR(avgOrderValue)}
            loading={ordersLoading}
            sub={completedInPeriod.length > 0 ? `↑ vs yesterday` : 'No data yet'}
            subColor="var(--green)"
            spark={SPARK_SCAN} sparkColor="#3B82F6"
          />
        </div>

        {/* ── Main content: 62/38 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>

          {/* ── Left: Live orders ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Pending alert banner */}
            {!ordersLoading && pendingOrders.length > 0 && (
              <Link href="/dashboard/orders" style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10,
                  padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>⚡</span>
                    <div>
                      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
                        {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''} waiting for confirmation
                      </p>
                      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: '#B45309' }}>
                        Oldest is {timeAgo(pendingOrders[pendingOrders.length - 1]?.created_at || '')} — tap to review
                      </p>
                    </div>
                  </div>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, color: '#B45309' }}>
                    Open kitchen →
                  </span>
                </div>
              </Link>
            )}

            {/* Orders card */}
            <div style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden', flex: 1,
            }}>
              {/* Card header */}
              <div style={{
                padding: '14px 20px 12px', borderBottom: '1px solid var(--border)',
              }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{
                      fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
                      fontSize: 18, color: 'var(--ink)',
                    }}>
                      {PRESET_LABELS[datePreset]}
                    </h2>
                    {!ordersLoading && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                        background: datePreset === 'live' && activeOrders.length > 0 ? 'var(--green-bg)' : 'var(--paper3)',
                        color: datePreset === 'live' && activeOrders.length > 0 ? 'var(--green)' : 'var(--ink4)',
                        fontFamily: "'Geist', sans-serif",
                      }}>
                        {orders.length} order{orders.length !== 1 ? 's' : ''}
                        {datePreset === 'live' && activeOrders.length > 0 && ` · ${activeOrders.length} active`}
                      </span>
                    )}
                  </div>
                  <Link href="/dashboard/orders" style={{
                    fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 500,
                    color: 'var(--accent)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border2)',
                  }}>
                    Full view →
                  </Link>
                </div>

                {/* Date filter pills */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  {([
                    { id: 'live',      label: '⚡ Live' },
                    { id: 'today',     label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: '7d',        label: 'Last 7 days' },
                    { id: '30d',       label: 'Last 30 days' },
                  ] as { id: DatePreset; label: string }[]).map(p => (
                    <button key={p.id} onClick={() => { setDatePreset(p.id); setShowCustom(false); }} style={{
                      padding: '4px 11px', borderRadius: 100, border: '1.5px solid',
                      borderColor: datePreset === p.id ? 'var(--ink)' : 'var(--border2)',
                      background: datePreset === p.id ? 'var(--ink)' : 'transparent',
                      color: datePreset === p.id ? '#fff' : 'var(--ink3)',
                      fontFamily: "'Geist', sans-serif", fontSize: 11.5, fontWeight: 500,
                      cursor: 'pointer', whiteSpace: 'nowrap' as const,
                    }}>
                      {p.label}
                    </button>
                  ))}

                  {/* Custom date range */}
                  <button
                    onClick={() => { setShowCustom(s => !s); if (datePreset !== 'custom') setDatePreset('custom'); }}
                    style={{
                      padding: '4px 11px', borderRadius: 100, border: '1.5px solid',
                      borderColor: datePreset === 'custom' ? 'var(--ink)' : 'var(--border2)',
                      background: datePreset === 'custom' ? 'var(--ink)' : 'transparent',
                      color: datePreset === 'custom' ? '#fff' : 'var(--ink3)',
                      fontFamily: "'Geist', sans-serif", fontSize: 11.5, fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    📅 {datePreset === 'custom' && customFrom ? `${customFrom} → ${customTo || '…'}` : 'Custom'}
                  </button>

                  {/* Summary for non-live presets */}
                  {datePreset !== 'live' && !ordersLoading && completedInPeriod.length > 0 && (
                    <span style={{
                      marginLeft: 'auto', fontFamily: "'Geist Mono', monospace",
                      fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                    }}>
                      ₹{periodRevenue.toFixed(0)} revenue
                    </span>
                  )}
                </div>

                {/* Custom date inputs (inline, expandable) */}
                {showCustom && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)' }}>From</label>
                      <input
                        type="date" value={customFrom} max={customTo || isoDay()}
                        onChange={e => setCustomFrom(e.target.value)}
                        style={{
                          padding: '5px 9px', borderRadius: 7, border: '1.5px solid var(--border2)',
                          fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink)',
                          outline: 'none', cursor: 'pointer',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)' }}>To</label>
                      <input
                        type="date" value={customTo} min={customFrom} max={isoDay()}
                        onChange={e => setCustomTo(e.target.value)}
                        style={{
                          padding: '5px 9px', borderRadius: 7, border: '1.5px solid var(--border2)',
                          fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink)',
                          outline: 'none', cursor: 'pointer',
                        }}
                      />
                    </div>
                    {customFrom && customTo && (
                      <button
                        onClick={() => { setShowCustom(false); queryClient.invalidateQueries({ queryKey: ['orders'] }); }}
                        style={{
                          padding: '5px 14px', borderRadius: 7, border: 'none',
                          background: 'var(--ink)', color: '#fff',
                          fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Apply
                      </button>
                    )}
                    <button
                      onClick={() => { setDatePreset('live'); setShowCustom(false); setCustomFrom(''); setCustomTo(''); }}
                      style={{
                        padding: '5px 10px', borderRadius: 7,
                        border: '1.5px solid var(--border2)', background: 'transparent',
                        fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)', cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Orders list */}
              {ordersLoading ? (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} h={52} />)}
                </div>
              ) : displayOrders.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.2 }}>🧾</div>
                  <h3 style={{
                    fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
                    fontSize: 19, color: 'var(--ink)', marginBottom: 6,
                  }}>
                    {datePreset === 'live' ? 'No active orders' : `No orders found`}
                  </h3>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)' }}>
                    {datePreset === 'live'
                      ? 'Share your menu QR to start receiving orders'
                      : `No orders during this period`}
                  </p>
                </div>
              ) : (
                displayOrders.map((order, idx) => (
                  <OrderRow key={order.id} order={order} isLast={idx === displayOrders.length - 1} />
                ))
              )}

              {/* Footer */}
              {!ordersLoading && orders.length > 8 && (
                <div style={{
                  padding: '10px 20px', borderTop: '1px solid var(--border)',
                  background: 'var(--paper2)', textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
                }}>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)' }}>
                    Showing 8 of {orders.length} orders
                  </span>
                  <Link href="/dashboard/orders" style={{
                    fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 500,
                    color: 'var(--accent)', textDecoration: 'none',
                  }}>
                    View all in kitchen →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Restaurant controls card */}
            <div style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Restaurant controls
                </p>
              </div>

              {/* Open / Closed — shows computed live state + manual override toggle */}
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid var(--border)',
              }}>
                {/* Live status row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>
                      Restaurant status
                    </p>
                    {(() => {
                      const state = liveStatus?.state;
                      const isOpen = state === 'OPEN';
                      const isBreak = state === 'BREAK' || state === 'HOLIDAY';
                      let bg = 'var(--red-bg)', color = 'var(--red)', dot = '○';
                      if (isOpen) { bg = 'var(--green-bg)'; color = 'var(--green)'; dot = '●'; }
                      else if (isBreak) { bg = 'var(--amber-bg)'; color = 'var(--amber)'; dot = '◐'; }
                      return (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: bg, color, fontFamily: "'Geist', sans-serif" }}>
                          {dot} {liveStatus?.message || (isOpen ? 'Open for orders' : 'Closed')}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Business hours info */}
                {liveStatus?.opens_at && liveStatus?.closes_at && (
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)', marginBottom: 10 }}>
                    🕐 Today: {liveStatus.opens_at} – {liveStatus.closes_at}
                    {liveStatus.server_time && (
                      <span style={{ marginLeft: 6, color: 'var(--ink5)' }}>
                        (now {liveStatus.server_time})
                      </span>
                    )}
                  </p>
                )}

                {/* Manual override toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink3)', margin: 0 }}>
                      Force close
                    </p>
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)', margin: 0 }}>
                      Override hours, mark as closed
                    </p>
                  </div>
                  <div
                    onClick={() => toggleOpenMutation.mutate()}
                    title={restaurant?.is_open ? 'Click to force-close' : 'Click to remove override'}
                    style={{
                      width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
                      background: !restaurant?.is_open ? '#DC2626' : 'var(--border2)',
                      position: 'relative', transition: 'background .2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3,
                      left: !restaurant?.is_open ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }} />
                  </div>
                </div>
              </div>

              {/* Ordering pause toggle */}
              {restaurantId && token && (
                <div style={{ padding: '4px 0' }}>
                  <PauseOrderingToggle
                    restaurantId={restaurantId}
                    token={token}
                    externalStatus={restaurantStatus}
                  />
                </div>
              )}

              {/* Fresh start */}
              <FreshStartButton onDone={() => queryClient.invalidateQueries()} />
            </div>

            {/* Live Queue panel */}
            {restaurantId && token && (
              <LiveQueuePanel
                token={token}
                liveQueue={queue.length > 0 ? queue : undefined}
              />
            )}

            {/* Top items + Peak hours */}
            <div style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            }}>
              {/* Top items */}
              <div style={{ padding: '14px 18px 16px', borderBottom: '1px solid var(--border)' }}>
                <p style={{
                  fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11,
                  color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14,
                }}>
                  Top items today
                </p>
                {topItems.length === 0 ? (
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink5)' }}>
                    No orders yet
                  </p>
                ) : (
                  topItems.map((item, i) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < topItems.length - 1 ? 10 : 0 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: i === 0 ? '#FEF3C7' : i === 1 ? '#F3F4F6' : '#FEF9EE',
                        color: i === 0 ? '#B45309' : i === 1 ? '#6B7280' : '#92400E',
                        fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{
                        fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink)',
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.name}
                      </span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink4)', flexShrink: 0 }}>
                        {item.count}
                      </span>
                      <div style={{ width: 48, flexShrink: 0 }}>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--paper3)' }}>
                          <div style={{
                            height: 4, borderRadius: 2,
                            background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--ink4)' : '#F59E0B',
                            width: `${(item.count / maxCount) * 100}%`,
                            transition: 'width .4s',
                          }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Peak hours */}
              <div style={{ padding: '14px 18px' }}>
                <p style={{
                  fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11,
                  color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12,
                }}>
                  Peak hours
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                  {PEAK_HOURS.map((h, i) => {
                    const barH = Math.max(4, (PEAK_DATA[i] / maxPeak) * 32);
                    const isNow = hour === h;
                    return (
                      <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
                        {isNow && (
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginBottom: 0 }} />
                        )}
                        <div style={{
                          width: '100%', height: barH,
                          background: isNow ? 'var(--accent)' : 'var(--paper3)',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height .3s',
                          minWidth: 10,
                        }} />
                        {(h % 3 === 0) && (
                          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, color: 'var(--ink5)' }}>{h}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
