'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useDashboardStore } from '@/lib/store';
import { useSocket } from '@/hooks/useSocket';
import type { Order, OrderStatus } from '@dineflow/types';

type Columns = { PENDING: Order[]; PREPARING: Order[]; READY: Order[] };

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

function TableBadge({ tableId }: { tableId?: string }) {
  const label = tableId || 'T';
  let bg = '#EEEDFE', color = '#3C3489';
  if (label.toLowerCase().startsWith('r')) { bg = '#FAECE7'; color = '#993C1D'; }
  else if (label.toLowerCase().includes('bar')) { bg = '#EAF3EE'; color = '#2D6A40'; }
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6, background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 500, color }}>{label.slice(0, 3)}</span>
    </div>
  );
}

function OrderCard({ order, onAction }: { order: Order; onAction: (id: string, status: OrderStatus) => void }) {
  const nextStatus: Record<string, { label: string; status: OrderStatus; bg: string; color: string; border: string }> = {
    PENDING: { label: 'Confirm order', status: 'CONFIRMED' as OrderStatus, bg: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid rgba(24,95,165,.2)' },
    CONFIRMED: { label: 'Confirm order', status: 'CONFIRMED' as OrderStatus, bg: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid rgba(24,95,165,.2)' },
    PREPARING: { label: 'Mark as ready ✓', status: 'READY' as OrderStatus, bg: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(45,122,74,.2)' },
    READY: { label: 'Mark as served', status: 'SERVED' as OrderStatus, bg: 'var(--accent)', color: '#fff', border: 'none' },
  };

  const action = nextStatus[order.status];
  const showItems = order.items.slice(0, 4);
  const extraCount = order.items.length - 4;

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '14px 16px', marginBottom: 8,
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.06)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <TableBadge tableId={order.table_id} />
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink4)', flex: 1 }}>
          #{order.id.slice(-6)}
        </span>
        <ElapsedBadge created_at={order.created_at} />
      </div>

      {/* Customer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)' }}>
          {order.customer_name || 'Guest'}
        </span>
        <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 12, color: 'var(--ink4)' }}>
          · {order.covers} guest{order.covers !== 1 ? 's' : ''}
        </span>
      </div>

      {order.waiter_id && (
        <span style={{
          fontFamily: "'Geist', sans-serif", fontSize: 11, background: 'var(--paper3)',
          borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginBottom: 6, color: 'var(--ink3)',
        }}>via waiter</span>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

      {/* Items */}
      <div style={{ marginBottom: 8 }}>
        {showItems.map(item => (
          <p key={item.id} style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>
            {item.quantity}× {item.item_name}
          </p>
        ))}
        {extraCount > 0 && (
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)' }}>+{extraCount} more</p>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

      {/* Action */}
      {action && (
        <button
          onClick={() => onAction(order.id, action.status)}
          style={{
            width: '100%', padding: 8, borderRadius: 7,
            background: action.bg, color: action.color, border: action.border,
            fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function KanbanColumn({ title, orders, badge, onAction }: {
  title: string; orders: Order[];
  badge: { bg: string; color: string };
  onAction: (id: string, status: OrderStatus) => void;
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
          <OrderCard key={order.id} order={order} onAction={onAction} />
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

export default function OrdersPage() {
  const { restaurant } = useDashboardStore();
  const restaurantId = restaurant?.id || '';
  const [columns, setColumns] = useState<Columns>({ PENDING: [], PREPARING: [], READY: [] });
  const [filter, setFilter] = useState('All');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const socketRef = useSocket(restaurantId, 'kitchen');

  useEffect(() => {
    api.get('/orders').then(r => {
      const orders: Order[] = r.data;
      setColumns({
        PENDING: orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED'),
        PREPARING: orders.filter(o => o.status === 'PREPARING'),
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
        if (status === 'PENDING' || status === 'CONFIRMED') newCols.PENDING = [updated, ...newCols.PENDING];
        else if (status === 'PREPARING') newCols.PREPARING = [updated, ...newCols.PREPARING];
        else if (status === 'READY') newCols.READY = [updated, ...newCols.READY];
        return newCols;
      });
      setLastUpdate(new Date());
    };
    socket.on('order:new', handleNew);
    socket.on('order:status', handleStatus);
    return () => { socket.off('order:new', handleNew); socket.off('order:status', handleStatus); };
  }, [socketRef.current]);

  // Seconds ago ticker
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdate.getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  const handleAction = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    await api.patch(`/orders/${orderId}/status`, { status: newStatus });
    setColumns(prev => {
      const all = [...prev.PENDING, ...prev.PREPARING, ...prev.READY];
      const order = all.find(o => o.id === orderId);
      if (!order) return prev;
      const updated = { ...order, status: newStatus };
      const remove = (arr: Order[]) => arr.filter(o => o.id !== orderId);
      const newCols: Columns = { PENDING: remove(prev.PENDING), PREPARING: remove(prev.PREPARING), READY: remove(prev.READY) };
      if (newStatus === 'CONFIRMED') newCols.PREPARING = [updated, ...newCols.PREPARING];
      else if (newStatus === 'READY') newCols.READY = [updated, ...newCols.READY];
      return newCols;
    });
    setLastUpdate(new Date());
  }, []);

  const filterPills = ['All', 'Dine-in', 'Room service', 'Takeaway'];

  return (
    <>
      <style>{`@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      {/* Header */}
      <div style={{ padding: '28px 28px 0', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 26, color: 'var(--ink)' }}>Live orders</h1>
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

          {/* Print KOT */}
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
          badge={{ bg: 'var(--paper3)', color: 'var(--ink4)' }}
          onAction={handleAction}
        />
        <KanbanColumn
          title="Preparing"
          orders={columns.PREPARING}
          badge={{ bg: 'var(--amber-bg)', color: 'var(--amber)' }}
          onAction={handleAction}
        />
        <KanbanColumn
          title="Ready"
          orders={columns.READY}
          badge={{ bg: 'var(--green-bg)', color: 'var(--green)' }}
          onAction={handleAction}
        />
      </div>
    </>
  );
}
