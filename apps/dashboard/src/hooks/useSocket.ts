'use client';
import React, { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDashboardStore } from '../lib/store';
import { WEBSOCKET_EVENTS } from '@dineflow/config';
import { Order, OrderStatus } from '@dineflow/types';

export function useSocket(restaurantId: string, role: 'dashboard' | 'kitchen' | 'waiter'): React.MutableRefObject<Socket | null> {
  const socketRef = useRef<Socket | null>(null);
  const { addOrder, updateOrderStatus } = useDashboardStore();

  useEffect(() => {
    if (!restaurantId) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
      path: '/ws',
      auth: { token: localStorage.getItem('dineflow_token') },
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

    socket.on('disconnect', () => console.log('[WS] Disconnected'));

    return () => { socket.disconnect(); };
  }, [restaurantId, role]);

  return socketRef;
}
