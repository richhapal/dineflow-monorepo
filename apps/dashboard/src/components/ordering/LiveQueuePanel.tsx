'use client';
import { useEffect, useState } from 'react';
import { QueuedOrderItem } from '../../hooks/useSocket';

interface Props {
  token: string;
  /** Live queue pushed from WebSocket — if provided, replaces fetched data */
  liveQueue?: QueuedOrderItem[];
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function formatAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function LiveQueuePanel({ token, liveQueue }: Props) {
  const [queue, setQueue] = useState<QueuedOrderItem[]>([]);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Initial fetch
  useEffect(() => {
    fetch(`${API}/orders/queue`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setQueue(data);
          setLastFetch(new Date());
        }
      })
      .catch(console.error);
  }, [token]);

  // Sync from WebSocket
  useEffect(() => {
    if (liveQueue) {
      setQueue(liveQueue);
      setLastFetch(new Date());
    }
  }, [liveQueue]);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Live Queue</span>
          {queue.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5">
              {queue.length}
            </span>
          )}
        </div>
        {lastFetch && (
          <span className="text-[11px] text-muted-foreground">
            Updated {formatAgo(lastFetch.toISOString())}
          </span>
        )}
      </div>

      {/* Body */}
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <span className="text-2xl mb-1">🎉</span>
          <p className="text-sm">Queue is empty</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {queue.map((item, idx) => (
            <li key={item.orderId} className="flex items-center gap-3 px-4 py-3">
              {/* Position badge */}
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate">{item.customerName}</span>
                  <span className="text-xs font-mono text-muted-foreground">{item.sessionId}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.seatIdentifier && (
                    <span className="text-xs text-muted-foreground">📍 {item.seatIdentifier}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{item.itemCount} item{item.itemCount !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">₹{item.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <span className="flex-shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                {formatAgo(item.placedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
