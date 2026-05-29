import { create } from 'zustand';
import { Order, OrderStatus, Restaurant, Staff } from '@dineflow/types';

interface DashboardStore {
  // Restaurant
  restaurant: Restaurant | null;
  setRestaurant: (r: Restaurant) => void;

  // Live orders
  liveOrders: Order[];
  setLiveOrders: (orders: Order[]) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  addOrder: (order: Order) => void;

  // Auth
  token: string | null;
  user: Staff | null;
  setAuth: (token: string, user: Staff) => void;
  clearAuth: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  restaurant: null,
  setRestaurant: (restaurant) => set({ restaurant }),

  liveOrders: [],
  setLiveOrders: (liveOrders) => set({ liveOrders }),
  updateOrderStatus: (id, status) =>
    set((state) => ({
      liveOrders: state.liveOrders.map((o) =>
        o.id === id ? { ...o, status } : o
      ),
    })),
  addOrder: (order) =>
    set((state) => ({ liveOrders: [order, ...state.liveOrders] })),

  token: null,
  user: null,
  setAuth: (token, user) => {
    if (typeof window !== 'undefined') localStorage.setItem('dineflow_token', token);
    set({ token, user });
  },
  clearAuth: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('dineflow_token');
    set({ token: null, user: null });
  },
}));
