'use client';

import { create } from 'zustand';

export interface CartItem {
  menuItemId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  image?: string;
  foodType?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (menuItemId: string, variantId?: string) => void;
  updateQty: (menuItemId: string, variantId: string | undefined, qty: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => {
    set((s) => {
      const existing = s.items.find(
        (i) => i.menuItemId === item.menuItemId && i.variantId === item.variantId
      );
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.menuItemId === item.menuItemId && i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return { items: [...s.items, { ...item, quantity: 1 }] };
    });
  },
  removeItem: (menuItemId, variantId) => {
    set((s) => ({
      items: s.items.filter(
        (i) => !(i.menuItemId === menuItemId && i.variantId === variantId)
      ),
    }));
  },
  updateQty: (menuItemId, variantId, qty) => {
    if (qty <= 0) {
      get().removeItem(menuItemId, variantId);
    } else {
      set((s) => ({
        items: s.items.map((i) =>
          i.menuItemId === menuItemId && i.variantId === variantId
            ? { ...i, quantity: qty }
            : i
        ),
      }));
    }
  },
  clear: () => set({ items: [] }),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
