'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { formatINR } from '@dineflow/utils';
import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';

const R2_BASE = 'https://pub-ecd37ff84be944469f0f332fdd932555.r2.dev';

function imgUrl(publicId: string | null): string | null {
  if (!publicId) return null;
  return publicId.startsWith('http') ? publicId : `${R2_BASE}/${publicId}`;
}

interface SessionItem {
  id: string;
  item_name: string;
  quantity: number;
  total_price: number;
  is_cancelled: boolean;
}

interface SessionOrder {
  id: string;
  status: string;
  customer_name?: string | null;
  items: SessionItem[];
}

interface SessionData {
  id: string;
  session_qr_slug: string;
  status: string;
  table: { id: string; name: string; capacity: number };
  restaurant: { id: string; name: string; slug: string; logo_public_id: string | null };
  orders: SessionOrder[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  food_type: string | null;
  image_public_id: string | null;
  variants: Array<{ id: string; name: string; price: number; is_default: boolean }>;
}

interface Category {
  id: string;
  name: string;
  menuItems: MenuItem[];
}

interface MenuData {
  categories: Category[];
}

function FoodDot({ type }: { type: string | null }) {
  const color = type === 'VEG' ? '#2D7A4A' : type === 'NON_VEG' ? '#8B3A3A' : '#999';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
      <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="1.5" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="7" cy="7" r="3.5" fill={color} />
    </svg>
  );
}

export default function SessionMenuPage({
  session,
  menuData,
  sessionSlug,
}: {
  session: SessionData;
  menuData: MenuData;
  sessionSlug: string;
}) {
  const cartItems = useCart(s => s.items);
  const total = useCart(s => s.total());
  const addItem = useCart(s => s.addItem);
  const updateQty = useCart(s => s.updateQty);
  const clear = useCart(s => s.clear);
  const [showCart, setShowCart] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState<{ id: string; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');

  const restaurant = session.restaurant;
  const logoUrl = imgUrl(restaurant.logo_public_id);

  // All non-cancelled items already ordered in this session
  const existingItems = session.orders
    .flatMap(o => o.items.filter(i => !i.is_cancelled))
    .reduce<{ name: string; qty: number; total: number }[]>((acc, item) => {
      const existing = acc.find(a => a.name === item.item_name);
      if (existing) {
        existing.qty += item.quantity;
        existing.total += Number(item.total_price);
      } else {
        acc.push({ name: item.item_name, qty: item.quantity, total: Number(item.total_price) });
      }
      return acc;
    }, []);

  async function handlePlaceOrder() {
    if (cartItems.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/orders/table-session/${sessionSlug}`, {
        customer_name: customerName.trim() || 'Guest',
        idempotency_key: crypto.randomUUID(),
        items: cartItems.map(i => ({
          menu_item_id: i.menuItemId,
          variant_id: i.variantId,
          quantity: i.quantity,
        })),
      });
      clear();
      setShowCart(false);
      setOrderPlaced({ id: res.data.id, total: Number(res.data.total_amount) });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }

  const sans = "'Geist', system-ui, sans-serif";
  const mono = "'Geist Mono', monospace";

  if (orderPlaced) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: sans }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <p style={{ fontSize: 56, marginBottom: 16 }}>🎉</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>Order placed!</p>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Your order has been sent to the kitchen.</p>
          <p style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: '#111', margin: '20px 0' }}>
            {formatINR(orderPlaced.total)}
          </p>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
            Dining at {session.table.name} · {restaurant.name}
          </p>
          <button
            onClick={() => { setOrderPlaced(null); }}
            style={{ padding: '10px 28px', borderRadius: 10, background: '#111', color: '#fff', border: 'none', fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Order More
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f9fafb', fontFamily: sans }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        {logoUrl && (
          <Image src={logoUrl} alt={restaurant.name} width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#111', margin: 0 }}>{restaurant.name}</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Group Order · {session.table.name}</p>
        </div>
      </div>

      {/* Already ordered by the group */}
      {existingItems.length > 0 && (
        <div style={{ margin: '16px', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>
              Already ordered by the group
            </p>
          </div>
          <div style={{ padding: '8px 16px 12px' }}>
            {existingItems.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>{item.qty}× {item.name}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: '#9ca3af' }}>{formatINR(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Menu */}
      <div style={{ padding: '0 16px 120px' }}>
        {menuData.categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.07em', margin: '20px 0 10px' }}>
              {cat.name}
            </p>
            {cat.menuItems.map(item => {
              const cartItem = cartItems.find(c => c.menuItemId === item.id);
              const qty = cartItem?.quantity ?? 0;
              const defaultVariant = item.variants.find(v => v.is_default) ?? item.variants[0];
              const price = defaultVariant?.price ?? item.base_price;

              return (
                <div key={item.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <FoodDot type={item.food_type} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{item.name}</span>
                    </div>
                    {item.description && (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.4 }}>{item.description}</p>
                    )}
                    <p style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>{formatINR(price)}</p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {qty === 0 ? (
                      <button
                        onClick={() => addItem({ menuItemId: item.id, variantId: defaultVariant?.id, name: item.name, price, quantity: 1 })}
                        style={{ padding: '6px 16px', borderRadius: 8, background: '#111', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Add
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => updateQty(item.id, defaultVariant?.id, qty - 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 16, cursor: 'pointer' }}>−</button>
                        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => updateQty(item.id, defaultVariant?.id, qty + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 16, cursor: 'pointer' }}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Floating Cart Button */}
      {cartItems.length > 0 && !showCart && (
        <div style={{ position: 'fixed', bottom: 24, left: 16, right: 16, zIndex: 20 }}>
          <button
            onClick={() => setShowCart(true)}
            style={{ width: '100%', padding: '14px', borderRadius: 14, background: '#111', color: '#fff', border: 'none', fontFamily: sans, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}
          >
            <span style={{ background: '#fff', color: '#111', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 700 }}>
              {cartItems.reduce((s, i) => s + i.quantity, 0)} items
            </span>
            <span>View Order</span>
            <span style={{ fontFamily: mono }}>{formatINR(total)}</span>
          </button>
        </div>
      )}

      {/* Cart / Checkout Sheet */}
      {showCart && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 30 }} onClick={() => setShowCart(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', zIndex: 40, padding: '20px 20px 40px', maxHeight: '80dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>Your Order</p>
              <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#6b7280', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {cartItems.map(item => (
              <div key={item.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '0 0 2px' }}>{item.name}</p>
                  <p style={{ fontFamily: mono, fontSize: 12, color: '#6b7280', margin: 0 }}>{formatINR(item.price)} each</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateQty(item.menuItemId, item.variantId, item.quantity - 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.menuItemId, item.variantId, item.quantity + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Your name (optional)</p>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: sans, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button
              onClick={handlePlaceOrder}
              disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: loading ? '#6b7280' : '#111', color: '#fff', border: 'none', fontFamily: sans, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{loading ? 'Placing…' : 'Place Order'}</span>
              <span style={{ fontFamily: mono }}>{formatINR(total)}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
