'use client';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface OrderingStatus {
  paused: boolean;
  reason: string | null;
  pause_until: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

/**
 * Fetches the current ordering pause status for a restaurant and subscribes
 * to real-time updates via WebSocket. Customers see instant pause/resume.
 */
export function useOrderingStatus(restaurantSlug: string, restaurantId: string): OrderingStatus {
  const [status, setStatus] = useState<OrderingStatus>({
    paused: false,
    reason: null,
    pause_until: null,
  });
  const socketRef = useRef<Socket | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!restaurantSlug) return;
    fetch(`${API}/restaurants/${restaurantSlug}/ordering-status`)
      .then((r) => r.json())
      .then((data: OrderingStatus) => setStatus(data))
      .catch(() => {/* degrade gracefully */});
  }, [restaurantSlug]);

  // Real-time subscription
  useEffect(() => {
    if (!restaurantId) return;

    const socket = io(`${WS}/ws`, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:customer', { restaurant_id: restaurantId });
    });

    socket.on('restaurant:status', (payload: { paused: boolean; reason: string | null }) => {
      setStatus((prev) => ({ ...prev, paused: payload.paused, reason: payload.reason }));
    });

    return () => {
      socket.disconnect();
    };
  }, [restaurantId]);

  return status;
}
