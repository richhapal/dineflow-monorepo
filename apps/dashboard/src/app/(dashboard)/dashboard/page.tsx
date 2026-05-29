'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useDashboardStore } from '@/lib/store';
import { useSocket } from '@/hooks/useSocket';
import { formatINR, timeAgo } from '@dineflow/utils';
import type { Order, OrderStatus } from '@dineflow/types';

const SPARKLINE_DATA = [28, 35, 22, 40, 31, 44, 38];
const MAX_SPARK = Math.max(...SPARKLINE_DATA);
const MIN_SPARK = Math.min(...SPARKLINE_DATA);

function Sparkline() {
  const w = 60, h = 24;
  const pts = SPARKLINE_DATA.map((v, i) => {
    const x = (i / (SPARKLINE_DATA.length - 1)) * w;
    const y = h - ((v - MIN_SPARK) / (MAX_SPARK - MIN_SPARK)) * h;
    return `${x},${y}`;
  });
  const linePath = `M${pts.join(' L')}`;
  const fillPath = `M0,${h} L${pts.join(' L')} L${w},${h} Z`;

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(184,92,44,.15)" />
          <stop offset="100%" stopColor="rgba(184,92,44,0)" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#sg)" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Skeleton({ w, h }: { w?: number | string; h?: number }) {
  return (
    <div style={{
      width: w || '100%', height: h || 16, borderRadius: 6,
      background: 'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
      backgroundSize: '600px 100%',
      animation: 'shimmer 1.5s infinite linear',
    }} />
  );
}

function TableBadge({ tableId }: { tableId?: string }) {
  const label = tableId?.split('-')[0] || 'T';
  let bg = '#EEEDFE', color = '#3C3489';
  if (label.startsWith('R')) { bg = '#FAECE7'; color = '#993C1D'; }
  else if (label.toLowerCase().startsWith('bar')) { bg = '#EAF3EE'; color = '#2D6A40'; }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 7, background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 500, color }}>{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<string, { bg: string; color: string }> = {
    PENDING: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
    CONFIRMED: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
    PREPARING: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
    READY: { bg: 'var(--green-bg)', color: 'var(--green)' },
    SERVED: { bg: 'var(--green-bg)', color: 'var(--green)' },
    COMPLETED: { bg: 'var(--paper3)', color: 'var(--ink4)' },
    CANCELLED: { bg: 'var(--red-bg)', color: 'var(--red)' },
  };
  const s = map[status] || map.PENDING;
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 100, fontFamily: "'Geist', sans-serif",
    }}>{status}</span>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { restaurant, liveOrders } = useDashboardStore();
  const restaurantId = restaurant?.id || '';

  useSocket(restaurantId, 'dashboard');

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['orders', restaurantId],
    queryFn: () => api.get('/orders').then(r => r.data),
    refetchInterval: 30_000,
    enabled: !!restaurantId,
  });

  const toggleOpenMutation = useMutation({
    mutationFn: () => api.post('/restaurants/me/toggle-open', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant'] }),
  });

  const today = new Date().toDateString();
  const todayOrders = (orders || []).filter(o => new Date(o.created_at).toDateString() === today);
  const completedToday = todayOrders.filter(o => o.status === 'COMPLETED');
  const todayRevenue = completedToday.reduce((sum, o) => sum + o.total_amount, 0);
  const activeOrders = (orders || []).filter(o => ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status));
  const pendingCount = (orders || []).filter(o => o.status === 'PENDING').length;
  const avgOrderValue = completedToday.length ? todayRevenue / completedToday.length : 0;

  const displayOrders = liveOrders.length > 0 ? liveOrders.slice(0, 5) : (orders || []).slice(0, 5);

  // Top items
  const itemCounts: Record<string, { name: string; count: number }> = {};
  todayOrders.forEach(o => o.items.forEach(i => {
    if (!itemCounts[i.menu_item_id]) itemCounts[i.menu_item_id] = { name: i.item_name, count: 0 };
    itemCounts[i.menu_item_id].count += i.quantity;
  }));
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 3);
  const maxCount = topItems[0]?.count || 1;

  // Peak hours (fake for display)
  const peakHours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const peakData = [3, 8, 12, 9, 6, 4, 7, 14, 18, 15, 10, 5];
  const maxPeak = Math.max(...peakData);

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
      `}</style>
      <div style={{ padding: 28 }}>
        {/* Page title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: 'var(--ink)' }}>Dashboard</h1>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
          {/* Revenue */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Today&rsquo;s Revenue</p>
            {ordersLoading ? <Skeleton h={36} /> : (
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 32, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>
                {formatINR(todayRevenue)}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--green)' }}>↑ +18% vs yesterday</span>
              <Sparkline />
            </div>
          </div>

          {/* Live orders */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Live Orders</p>
            {ordersLoading ? <Skeleton h={36} /> : (
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 32, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>
                {activeOrders.length}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{
                background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 11, fontWeight: 500,
                padding: '2px 8px', borderRadius: 100, fontFamily: "'Geist', sans-serif",
              }}>{pendingCount} pending</span>
              <Sparkline />
            </div>
          </div>

          {/* QR scans */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>QR Scans</p>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 32, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>142</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--green)' }}>↑ +22% vs yesterday</span>
              <Sparkline />
            </div>
          </div>

          {/* Avg order value */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Avg Order Value</p>
            {ordersLoading ? <Skeleton h={36} /> : (
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 32, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>
                {formatINR(avgOrderValue)}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--green)' }}>↑ +₹85 vs average</span>
              <Sparkline />
            </div>
          </div>
        </div>

        {/* Row 2 — 60/40 */}
        <div style={{ display: 'grid', gridTemplateColumns: '60% 1fr', gap: 14 }}>
          {/* Live orders panel */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 18, color: 'var(--ink)' }}>Live orders</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ background: 'var(--green-bg)', color: 'var(--green)', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100, fontFamily: "'Geist', sans-serif" }}>
                  {activeOrders.length} active
                </span>
                <Link href="/dashboard/orders" style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
              </div>
            </div>

            {ordersLoading ? (
              <div style={{ padding: '16px 24px' }}>
                {[1,2,3].map(i => <Skeleton key={i} h={48} />)}
              </div>
            ) : displayOrders.length === 0 ? (
              /* Empty state */
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🧾</div>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>No orders yet</h3>
                <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 13, color: 'var(--ink4)', marginBottom: 16 }}>Your first order will appear here</p>
                <a href="#" style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>Share your menu →</a>
              </div>
            ) : (
              displayOrders.map((order, idx) => (
                <div key={order.id} style={{
                  padding: '13px 24px', borderBottom: idx < displayOrders.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <TableBadge tableId={order.table_id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)' }}>
                      {order.customer_name || `Table ${order.table_id || '—'}`}
                    </p>
                    <p style={{
                      fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 12, color: 'var(--ink4)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {order.items.map(i => i.item_name).join(', ')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink5)' }}>
                      {timeAgo(order.created_at)}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick stats */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
            {/* Open/close toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>Restaurant</p>
                <span style={{
                  background: restaurant?.is_open ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: restaurant?.is_open ? 'var(--green)' : 'var(--red)',
                  padding: '6px 14px', borderRadius: 100,
                  fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 500,
                }}>
                  {restaurant?.is_open ? '● Open for orders' : '○ Closed'}
                </span>
              </div>
              {/* Toggle */}
              <div
                onClick={() => toggleOpenMutation.mutate()}
                style={{
                  width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
                  background: restaurant?.is_open ? '#2D7A4A' : 'var(--border2)',
                  position: 'relative', transition: 'background .2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: restaurant?.is_open ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }} />
              </div>
            </div>

            {/* Top items */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Top items today</p>
              {topItems.length === 0 ? (
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink5)' }}>No orders yet</p>
              ) : (
                topItems.map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink5)', width: 12 }}>{i + 1}</span>
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink4)', width: 20, textAlign: 'right' }}>{item.count}</span>
                    <div style={{ width: 60 }}>
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--paper3)' }}>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--accent)', width: `${(item.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Peak hours */}
            <div>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Peak hours</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {peakHours.map((h, i) => {
                  const barH = Math.max(4, (peakData[i] / maxPeak) * 28);
                  const isNow = new Date().getHours() === h;
                  return (
                    <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: 14, height: barH,
                        background: isNow ? 'var(--accent)' : 'var(--paper3)',
                        borderRadius: '2px 2px 0 0', transition: 'height .3s',
                      }} />
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'var(--ink5)' }}>{h}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
