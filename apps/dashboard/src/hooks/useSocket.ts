'use client';
import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDashboardStore } from '../lib/store';
import { WEBSOCKET_EVENTS } from '@dineflow/config';
import { Order, OrderStatus } from '@dineflow/types';

export interface QueuedOrderItem {
  orderId: string;
  restaurantId: string;
  sessionId: string;
  customerName: string;
  seatIdentifier: string;
  itemCount: number;
  totalAmount: number;
  queuePosition: number;
  placedAt: string;
}

export interface RestaurantStatusPayload {
  paused: boolean;
  reason: string | null;
  updated_at: string;
}

export function useSocket(
  restaurantId: string,
  role: 'dashboard' | 'kitchen' | 'waiter',
): {
  socketRef: React.MutableRefObject<Socket | null>;
  queue: QueuedOrderItem[];
  restaurantStatus: RestaurantStatusPayload | null;
} {
  const socketRef = useRef<Socket | null>(null);
  const { addOrder, updateOrderStatus } = useDashboardStore();
  const [queue, setQueue] = useState<QueuedOrderItem[]>([]);
  const [restaurantStatus, setRestaurantStatus] = useState<RestaurantStatusPayload | null>(null);

  useEffect(() => {
    if (!restaurantId) return;

    // Gateway uses namespace '/ws' — connect to the namespace URL directly.
    // Do NOT use `path:'/ws'` (that changes the HTTP transport path, causing 404s).
    const base = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const socket = io(`${base}/ws`, {
      auth: { token: localStorage.getItem('dineflow_token') },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      socket.emit('join:restaurant', { restaurant_id: restaurantId, role });
    });

    socket.on(WEBSOCKET_EVENTS.ORDER_NEW, (order: Order) => {
      console.log('[WS] New order:', order.id);
      addOrder(order);
    });

    socket.on(WEBSOCKET_EVENTS.ORDER_STATUS, ({ order_id, status }: { order_id: string; status: OrderStatus }) => {
      updateOrderStatus(order_id, status);
    });

    socket.on('queue:update', ({ queue: updatedQueue }: { queue: QueuedOrderItem[] }) => {
      setQueue(updatedQueue);
    });

    socket.on(WEBSOCKET_EVENTS.RESTAURANT_STATUS, (payload: RestaurantStatusPayload) => {
      setRestaurantStatus(payload);
    });

    socket.on('disconnect', () => console.log('[WS] Disconnected'));

    return () => { socket.disconnect(); };
  }, [restaurantId, role]);

  return { socketRef, queue, restaurantStatus };
}
