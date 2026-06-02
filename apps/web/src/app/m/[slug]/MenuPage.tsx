'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { io } from 'socket.io-client';
import { formatINR } from '@dineflow/utils';
import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';
import { useOrderingStatus } from '@/hooks/useOrderingStatus';
import OrderingPausedScreen from '@/components/OrderingPausedScreen';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Variant {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
}

interface AddonGroup {
  id: string;
  name: string;
  addons: Array<{ id: string; name: string; price: number }>;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  food_type: string | null;
  image_public_id: string | null;
  is_bestseller: boolean;
  variants: Variant[];
  addonGroups: AddonGroup[];
}

interface Category {
  id: string;
  name: string;
  menuItems: MenuItem[];
}

interface QRData {
  id: string;
  slug: string;
  label: string;
  table: { id: string; name: string; section: string } | null;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_public_id: string | null;
    theme_config: Record<string, unknown> | null;
    is_ordering_enabled: boolean;
    ordering_mode: string;
  };
}

interface MenuData {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_public_id: string | null;
  };
  availability: { state: string; message?: string; opens_at?: string; closes_at?: string };
  categories: Category[];
  collections: unknown[];
}

interface OrderStatus {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  decline_reason?: string | null;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    item_name: string;
    menuItem?: { name: string } | null;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const R2_BASE = 'https://pub-ecd37ff84be944469f0f332fdd932555.r2.dev';

function menuImageUrl(publicId: string | null): string | null {
  if (!publicId) return null;
  if (publicId.startsWith('http')) return publicId;
  return `${R2_BASE}/${publicId}`;
}

// ─── Food Type Icon ──────────────────────────────────────────────────────────

function FoodTypeIcon({ type }: { type: string | null }) {
  if (!type) {
    return (
      <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="4" fill="#aaa" />
        </svg>
      </span>
    );
  }

  if (type === 'VEG') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="14" rx="2" stroke="#2D7A4A" strokeWidth="1.5" fill="none" />
        <circle cx="8" cy="8" r="4" fill="#2D7A4A" />
      </svg>
    );
  }

  if (type === 'NON_VEG') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="14" rx="2" stroke="#8B3A3A" strokeWidth="1.5" fill="none" />
        <polygon points="8,3 14,13 2,13" fill="#8B3A3A" />
      </svg>
    );
  }

  if (type === 'VEGAN') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="14" rx="2" stroke="#1a5c30" strokeWidth="1.5" fill="none" />
        <path d="M8 12 C6 10 4 8 5 5 C6 3 8 3 8 5 C8 3 10 3 11 5 C12 8 10 10 8 12Z" fill="#1a5c30" />
      </svg>
    );
  }

  if (type === 'EGG') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="14" rx="2" stroke="#B45309" strokeWidth="1.5" fill="none" />
        <ellipse cx="8" cy="8.5" rx="3.5" ry="4.5" fill="#B45309" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="#aaa" strokeWidth="1.5" fill="none" />
      <circle cx="8" cy="8" r="3" fill="#aaa" />
    </svg>
  );
}

// ─── Qty Stepper ─────────────────────────────────────────────────────────────

function QtyStepper({
  qty,
  onDecrement,
  onIncrement,
}: {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: '1.5px solid var(--accent)',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDecrement(); }}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        −
      </button>
      <span
        style={{
          width: 24,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--accent)',
        }}
      >
        {qty}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onIncrement(); }}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        +
      </button>
    </div>
  );
}

// ─── Variant Sheet ───────────────────────────────────────────────────────────

function VariantSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (variantId: string, variantName: string, price: number) => void;
}) {
  const defaultVariant = item.variants.find((v) => v.is_default) || item.variants[0];
  const [selected, setSelected] = useState<string>(defaultVariant?.id || '');

  const selectedVariant = item.variants.find((v) => v.id === selected);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          padding: '20px 16px 32px',
          zIndex: 201,
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: 'Instrument Serif', fontSize: 18, color: 'var(--ink)' }}>{item.name}</h3>
            {item.description && (
              <p style={{ fontSize: 13, color: 'var(--ink4)', marginTop: 4 }}>{item.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--ink3)', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Choose variant
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {item.variants.map((v) => (
            <label
              key={v.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1.5px solid ${selected === v.id ? 'var(--accent)' : 'var(--border)'}`,
                background: selected === v.id ? 'var(--accent-bg)' : '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  checked={selected === v.id}
                  onChange={() => setSelected(v.id)}
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: 'var(--ink)' }}>{v.name}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                {formatINR(v.price)}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={() => {
            if (selectedVariant) {
              onAdd(selectedVariant.id, selectedVariant.name, selectedVariant.price);
            }
          }}
          disabled={!selected}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            opacity: selected ? 1 : 0.5,
          }}
        >
          Add — {selectedVariant ? formatINR(selectedVariant.price) : ''}
        </button>
      </div>
    </>
  );
}

// ─── Menu Item Card ──────────────────────────────────────────────────────────

function MenuItemCard({
  item,
  isOrderingEnabled,
}: {
  item: MenuItem;
  isOrderingEnabled: boolean;
}) {
  const { items, addItem, updateQty } = useCart();
  const [showVariantSheet, setShowVariantSheet] = useState(false);

  const imageUrl = menuImageUrl(item.image_public_id);
  const hasVariants = item.variants.length > 1;

  // For single/no variants, find existing cart item
  const defaultVariant = item.variants.find((v) => v.is_default) || item.variants[0];
  const defaultVariantId = defaultVariant?.id;
  const cartItem = items.find(
    (i) => i.menuItemId === item.id && (hasVariants ? false : i.variantId === defaultVariantId)
  );

  // For multi-variant, total qty across all variants of this item
  const totalQtyInCart = items
    .filter((i) => i.menuItemId === item.id)
    .reduce((sum, i) => sum + i.quantity, 0);

  const price = defaultVariant ? defaultVariant.price : item.base_price;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (hasVariants) {
      setShowVariantSheet(true);
    } else {
      addItem({
        menuItemId: item.id,
        variantId: defaultVariantId,
        name: item.name,
        variantName: defaultVariant?.name,
        price,
        quantity: 1,
        image: imageUrl || undefined,
        foodType: item.food_type || undefined,
      });
    }
  }

  function handleAddVariant(variantId: string, variantName: string, variantPrice: number) {
    addItem({
      menuItemId: item.id,
      variantId,
      name: item.name,
      variantName,
      price: variantPrice,
      quantity: 1,
      image: imageUrl || undefined,
      foodType: item.food_type || undefined,
    });
    setShowVariantSheet(false);
  }

  return (
    <>
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '14px 12px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          position: 'relative',
        }}
      >
        {/* Left content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <FoodTypeIcon type={item.food_type} />
            {item.is_bestseller && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#B45309',
                  background: '#FEF3C7',
                  padding: '2px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Bestseller
              </span>
            )}
          </div>

          <h3
            style={{
              fontFamily: 'Instrument Serif',
              fontSize: 16,
              color: 'var(--ink)',
              marginBottom: 4,
              lineHeight: 1.3,
            }}
          >
            {item.name}
          </h3>

          {item.description && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--ink4)',
                lineHeight: 1.5,
                marginBottom: 8,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              {formatINR(price)}
              {hasVariants && <span style={{ color: 'var(--ink4)', fontWeight: 400, fontSize: 12 }}> +</span>}
            </span>

            {isOrderingEnabled && (
              <div onClick={(e) => e.stopPropagation()}>
                {!hasVariants && cartItem ? (
                  <QtyStepper
                    qty={cartItem.quantity}
                    onDecrement={() => updateQty(item.id, defaultVariantId, cartItem.quantity - 1)}
                    onIncrement={() => updateQty(item.id, defaultVariantId, cartItem.quantity + 1)}
                  />
                ) : (
                  <button
                    onClick={handleAdd}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: '#fff',
                      fontSize: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 400,
                      position: 'relative',
                    }}
                  >
                    +
                    {hasVariants && totalQtyInCart > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          background: '#fff',
                          color: 'var(--accent)',
                          border: '1.5px solid var(--accent)',
                          borderRadius: '50%',
                          width: 16,
                          height: 16,
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {totalQtyInCart}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: image */}
        {imageUrl && (
          <div style={{ flexShrink: 0, borderRadius: 8, overflow: 'hidden', width: 80, height: 80, position: 'relative' }}>
            <Image
              src={imageUrl}
              alt={item.name}
              fill
              sizes="80px"
              style={{ objectFit: 'cover' }}
            />
          </div>
        )}
      </div>

      {showVariantSheet && (
        <VariantSheet
          item={item}
          onClose={() => setShowVariantSheet(false)}
          onAdd={handleAddVariant}
        />
      )}
    </>
  );
}

// ─── Cart Drawer ─────────────────────────────────────────────────────────────

function CartDrawer({
  onClose,
  onCheckout,
}: {
  onClose: () => void;
  onCheckout: () => void;
}) {
  const { items, updateQty, total } = useCart();

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          zIndex: 301,
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontFamily: 'Instrument Serif', fontSize: 20, color: 'var(--ink)' }}>Your order</h2>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--paper2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: 'var(--ink3)',
            }}
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {items.length === 0 ? (
            <p style={{ color: 'var(--ink4)', textAlign: 'center', padding: '32px 0', fontSize: 14 }}>
              Your cart is empty
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((item) => (
                <div
                  key={`${item.menuItemId}-${item.variantId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.name}</p>
                    {item.variantName && (
                      <p style={{ fontSize: 12, color: 'var(--ink4)' }}>{item.variantName}</p>
                    )}
                    <p style={{ fontSize: 13, color: 'var(--ink3)', fontFamily: 'monospace', marginTop: 2 }}>
                      {formatINR(item.price * item.quantity)}
                    </p>
                  </div>
                  <QtyStepper
                    qty={item.quantity}
                    onDecrement={() => updateQty(item.menuItemId, item.variantId, item.quantity - 1)}
                    onIncrement={() => updateQty(item.menuItemId, item.variantId, item.quantity + 1)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '12px 16px 32px', borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                padding: '10px 0',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>Subtotal</span>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {formatINR(total())}
              </span>
            </div>
            <button
              onClick={onCheckout}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Proceed to checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Checkout Sheet ──────────────────────────────────────────────────────────

function CheckoutSheet({
  qrSlug,
  isTakeaway,
  onClose,
  onSuccess,
  onOrderingPaused,
}: {
  qrSlug: string;
  isTakeaway: boolean;
  onClose: () => void;
  onSuccess: (order: OrderStatus) => void;
  onOrderingPaused?: (reason?: string) => void;
}) {
  const { items, total, clear } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [seatIdentifier, setSeatIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const orderItems = items.map((i) => ({
        menu_item_id: i.menuItemId,
        variant_id: i.variantId,
        quantity: i.quantity,
      }));

      let res;
      if (isTakeaway) {
        // Outside / takeaway order — uses single-qr endpoint with queue + session
        const payload = {
          qr_slug: qrSlug,
          customer_name: customerName.trim() || 'Guest',
          customer_phone: customerPhone.trim() || undefined,
          seat_identifier: seatIdentifier.trim() || undefined,
          idempotency_key: idempotencyKey,
          items: orderItems,
        };
        res = await api.post('/orders/single-qr', payload);
      } else {
        // Table QR — dine-in, direct order
        const payload = {
          qr_slug: qrSlug,
          customer_name: customerName.trim() || 'Guest',
          idempotency_key: idempotencyKey,
          items: orderItems,
        };
        res = await api.post('/orders/public', payload);
      }

      clear();
      onSuccess(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      if (axiosErr.response?.data?.error === 'ORDERING_PAUSED') {
        onOrderingPaused?.(axiosErr.response?.data?.message);
        return;
      }
      setError(axiosErr.response?.data?.message || axiosErr.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 400,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          zIndex: 401,
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'Instrument Serif', fontSize: 20, color: 'var(--ink)' }}>Confirm order</h2>
            {isTakeaway && (
              <span style={{
                display: 'inline-block', marginTop: 3,
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                background: '#FFF7ED', color: '#C2410C',
                fontFamily: 'sans-serif', letterSpacing: '.04em',
              }}>
                🛍 Outside / Takeaway
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--paper2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: 'var(--ink3)',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* Name input */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Your name
            </label>
            <input
              type="text"
              placeholder="e.g. Arun"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1.5px solid var(--border)',
                fontSize: 15,
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
          </div>

          {/* Phone number — only for outside/takeaway */}
          {isTakeaway && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Phone number (optional)
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  fontSize: 15,
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Location note — only for outside/takeaway */}
          {isTakeaway && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Your location / note (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Car park, Gate 2, Blue scooter outside"
                value={seatIdentifier}
                onChange={(e) => setSeatIdentifier(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  fontSize: 15,
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Spacer for dine-in (no extra fields) */}
          {!isTakeaway && <div style={{ marginBottom: 6 }} />}

          {/* Order summary */}
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Order summary
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {items.map((item) => (
              <div
                key={`${item.menuItemId}-${item.variantId}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 14, color: 'var(--ink)' }}>
                  {item.name}
                  {item.variantName && <span style={{ color: 'var(--ink4)' }}> ({item.variantName})</span>}
                  <span style={{ color: 'var(--ink4)' }}> ×{item.quantity}</span>
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--ink3)' }}>
                  {formatINR(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Total</span>
            <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              {formatINR(total())}
            </span>
          </div>

          {error && (
            <div
              style={{
                background: 'var(--red-bg)',
                color: 'var(--red)',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px 32px' }}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 10,
              background: loading ? 'var(--ink5)' : 'var(--accent)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {loading ? 'Placing order...' : 'Confirm order'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Order Status Screen ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  PENDING:   { icon: '⏳', label: 'Order received', color: '#B45309', bg: '#FEF3C7' },
  CONFIRMED: { icon: '✅', label: 'Order confirmed', color: 'var(--green)', bg: 'var(--green-bg)' },
  PREPARING: { icon: '🍳', label: 'Being prepared', color: '#1D4ED8', bg: '#EFF6FF' },
  READY:     { icon: '🔔', label: 'Ready to serve', color: 'var(--green)', bg: 'var(--green-bg)' },
  SERVED:    { icon: '✅', label: 'Served', color: 'var(--green)', bg: 'var(--green-bg)' },
  COMPLETED: { icon: '✅', label: 'Completed', color: 'var(--green)', bg: 'var(--green-bg)' },
  CANCELLED: { icon: '✕', label: 'Cancelled', color: 'var(--red)', bg: 'var(--red-bg)' },
};

type WaiterModification = {
  item_id: string;
  item_name: string;
  cancelled?: boolean;
  new_quantity?: number;
  reason?: string;
};

function OrderStatusScreen({
  order: initialOrder,
  onAddMore,
}: {
  order: OrderStatus;
  onAddMore: () => void;
}) {
  const [order, setOrder] = useState<OrderStatus>(initialOrder);
  const [modification, setModification] = useState<{
    modifications: WaiterModification[];
    waiter_note: string | null;
  } | null>(null);

  // ── Real-time order status via Socket.io ─────────────────────────────────
  useEffect(() => {
    const terminal = ['COMPLETED', 'CANCELLED', 'SERVED'];
    if (terminal.includes(order.status)) return;

    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const socket = io(`${base}/ws`, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join:order', { order_id: initialOrder.id });
    });

    socket.on('order:status', (data: { order_id: string; status: string }) => {
      if (data.order_id === initialOrder.id) {
        setOrder((prev) => ({ ...prev, status: data.status }));
      }
    });

    // Decline / auto-cancel — carries the reason
    socket.on('order:declined', (data: { order_id: string; reason: string }) => {
      if (data.order_id === initialOrder.id) {
        setOrder((prev) => ({ ...prev, status: 'CANCELLED', decline_reason: data.reason }));
      }
    });

    // Waiter modified the order before confirming
    socket.on('order:modified', (data: {
      order_id: string;
      modifications: WaiterModification[];
      waiter_note: string | null;
      order: OrderStatus | null;
    }) => {
      if (data.order_id === initialOrder.id) {
        if (data.order) setOrder(data.order);
        setModification({ modifications: data.modifications, waiter_note: data.waiter_note });
      }
    });

    // Fallback poll every 15s in case socket misses an event
    const fallback = setInterval(async () => {
      try {
        const res = await api.get<OrderStatus>(`/orders/public/${initialOrder.id}`);
        setOrder(res.data);
      } catch { /* ignore */ }
    }, 15000);

    return () => {
      socket.disconnect();
      clearInterval(fallback);
    };
  }, [initialOrder.id, order.status]);

  const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f7f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 16px 32px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* ── Waiter modification notification ── */}
      {modification && modification.modifications.length > 0 && (
        <div style={{
          width: '100%', marginBottom: 18,
          background: '#FFFBEB', border: '1.5px solid #F59E0B',
          borderRadius: 14, padding: '16px',
          animation: 'slideIn .3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div>
                <p style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 15, color: '#92400E' }}>
                  Restaurant modified your order
                </p>
                <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#B45309', marginTop: 1 }}>
                  Some items were changed before preparation
                </p>
              </div>
            </div>
            <button
              onClick={() => setModification(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#92400E', lineHeight: 1 }}
            >×</button>
          </div>

          {/* Changed items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: modification.waiter_note ? 12 : 0 }}>
            {modification.modifications.map((m, i) => (
              <div key={i} style={{
                background: '#FEF3C7', borderRadius: 8, padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {m.cancelled ? (
                  <>
                    <span style={{ fontSize: 16 }}>✕</span>
                    <div>
                      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: '#92400E', textDecoration: 'line-through' }}>
                        {m.item_name}
                      </p>
                      {m.reason && (
                        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#B45309', marginTop: 2 }}>
                          {m.reason}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 16 }}>✏️</span>
                    <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                      {m.item_name} — quantity changed to {m.new_quantity}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Waiter message */}
          {modification.waiter_note && (
            <div style={{
              marginTop: 10, background: '#fff', borderRadius: 8, padding: '10px 12px',
              border: '1px solid #FDE68A',
            }}>
              <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 4 }}>
                💬 Message from restaurant:
              </p>
              <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#78350F' }}>
                {modification.waiter_note}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status banner */}
      <div
        style={{
          width: '100%',
          background: statusInfo.bg,
          border: `1px solid ${statusInfo.color}33`,
          borderRadius: 14,
          padding: '20px',
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 10 }}>{statusInfo.icon}</div>
        <h2
          style={{
            fontFamily: 'Instrument Serif',
            fontSize: 22,
            color: statusInfo.color,
            marginBottom: 6,
          }}
        >
          {statusInfo.label}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--ink4)', fontFamily: 'monospace' }}>
          Order #{order.id.slice(-8).toUpperCase()}
        </p>

        {/* Decline / auto-cancel reason */}
        {order.status === 'CANCELLED' && order.decline_reason && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(220,38,38,.2)',
          }}>
            <p style={{ fontSize: 13, color: 'var(--red)', fontFamily: "'Geist', sans-serif", fontWeight: 500 }}>
              Reason
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", marginTop: 2 }}>
              {order.decline_reason}
            </p>
          </div>
        )}
      </div>

      {/* Items */}
      <div
        style={{
          width: '100%',
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Items ordered
          </p>
        </div>
        {order.items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>
              {item.item_name || item.menuItem?.name}
              <span style={{ color: 'var(--ink4)' }}> ×{item.quantity}</span>
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--ink3)' }}>
              {formatINR(item.unit_price * item.quantity)}
            </span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--paper2)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Total</span>
          <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {formatINR(Number(order.total_amount))}
          </span>
        </div>
      </div>

      {/* Add more */}
      <button
        onClick={onAddMore}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 10,
          border: '1.5px solid var(--accent)',
          color: 'var(--accent)',
          fontSize: 15,
          fontWeight: 600,
          background: '#fff',
        }}
      >
        + Add more items
      </button>

      {/* Note about polling */}
      {!['COMPLETED', 'CANCELLED', 'SERVED'].includes(order.status) && (
        <p style={{ fontSize: 12, color: 'var(--ink5)', marginTop: 16, textAlign: 'center' }}>
          Status updates automatically every 10 seconds
        </p>
      )}
    </div>
  );
}

// ─── Closed Order Warning Dialog ─────────────────────────────────────────────

function ClosedOrderWarning({
  onPlaceAnyway,
  onCancel,
}: {
  onPlaceAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 500,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          padding: '24px 20px 36px',
          zIndex: 501,
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* Warning icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 16px',
          }}
        >
          ⚠️
        </div>

        <h3
          style={{
            fontFamily: 'Instrument Serif',
            fontSize: 20,
            color: 'var(--ink)',
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          Restaurant is currently closed
        </h3>

        <p
          style={{
            fontSize: 14,
            color: 'var(--ink4)',
            textAlign: 'center',
            lineHeight: 1.55,
            marginBottom: 24,
          }}
        >
          Your order will be sent when they reopen.
        </p>

        <button
          onClick={onPlaceAnyway}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            background: '#B45309',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Place order anyway
        </button>

        <button
          onClick={onCancel}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            background: 'var(--paper2)',
            color: 'var(--ink3)',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

// ─── Main MenuPage ───────────────────────────────────────────────────────────

export default function MenuPage({
  qrData,
  menuData,
  slug,
}: {
  qrData: QRData;
  menuData: MenuData;
  slug: string;
}) {
  const { count, total } = useCart();
  const [activeCategory, setActiveCategory] = useState<string>(
    menuData.categories[0]?.id || ''
  );
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showClosedWarning, setShowClosedWarning] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OrderStatus | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const { restaurant, availability, categories } = menuData;
  const isOrderingEnabled = qrData.restaurant.is_ordering_enabled;
  const isRestaurantOpen = availability.state === 'OPEN';
  const tableName = qrData.table?.name;
  // Outside/takeaway QR has no table assigned; use single-qr endpoint with TAKEAWAY type
  const isTakeaway = !qrData.table;

  // Live ordering pause status via WebSocket
  const orderingStatus = useOrderingStatus(restaurant.slug, qrData.restaurant.id);
  // Local override: set when checkout returns ORDERING_PAUSED (WebSocket will sync shortly after)
  const [localPausedReason, setLocalPausedReason] = useState<string | null>(null);
  const isPaused = orderingStatus.paused || localPausedReason !== null;

  // Intersection Observer to track active category while scrolling
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    Object.values(categoryRefs.current).forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [categories]);

  // Scroll category nav pill into view when active changes
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-catid="${activeCategory}"]`) as HTMLElement;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  function scrollToCategory(id: string) {
    const el = categoryRefs.current[id];
    if (el) {
      const offset = 110; // header + nav height
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setActiveCategory(id);
  }

  if (placedOrder) {
    return (
      <OrderStatusScreen
        order={placedOrder}
        onAddMore={() => setPlacedOrder(null)}
      />
    );
  }

  // Show ordering paused screen (real-time via WebSocket)
  if (isPaused) {
    return (
      <OrderingPausedScreen
        reason={localPausedReason || orderingStatus.reason}
        pauseUntil={orderingStatus.pause_until}
        restaurantName={restaurant.name}
      />
    );
  }

  const cartCount = count();
  const cartTotal = total();

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f7f7f7', position: 'relative' }}>
      {/* ── Sticky Header ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fff',
          borderBottom: '1px solid var(--border)',
          padding: '14px 16px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontFamily: 'Instrument Serif',
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--ink)',
                lineHeight: 1.2,
              }}
            >
              {restaurant.name}
            </h1>
            {tableName ? (
              <p style={{ fontSize: 13, color: 'var(--ink4)', marginTop: 2 }}>Table {tableName}</p>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                background: '#FFF7ED', color: '#C2410C',
              }}>
                🛍 Outside Order
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: isRestaurantOpen ? 'var(--green-bg)' : 'var(--red-bg)',
                color: isRestaurantOpen ? 'var(--green)' : 'var(--red)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isRestaurantOpen ? 'var(--green)' : 'var(--red)',
                  display: 'inline-block',
                }}
              />
              {isRestaurantOpen ? 'Open' : availability.message || 'Closed'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Category Nav ── */}
      {categories.length > 0 && (
        <div
          ref={navRef}
          style={{
            position: 'sticky',
            top: 65,
            zIndex: 99,
            background: '#fff',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
            display: 'flex',
            gap: 6,
            padding: '10px 14px',
            scrollbarWidth: 'none',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              data-catid={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                background: activeCategory === cat.id ? 'var(--accent)' : 'var(--paper2)',
                color: activeCategory === cat.id ? '#fff' : 'var(--ink3)',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Menu Sections ── */}
      <div style={{ padding: '16px 12px', paddingBottom: cartCount > 0 ? 100 : 32 }}>
        {categories.map((cat) => (
          <div
            key={cat.id}
            id={cat.id}
            ref={(el) => { categoryRefs.current[cat.id] = el; }}
            style={{ marginBottom: 24 }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--ink3)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 10,
                paddingLeft: 4,
              }}
            >
              {cat.name}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink5)', marginLeft: 8 }}>
                ({cat.menuItems.length})
              </span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cat.menuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  isOrderingEnabled={isOrderingEnabled}
                />
              ))}
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink4)' }}>
            <p style={{ fontSize: 16 }}>Menu coming soon</p>
          </div>
        )}
      </div>

      {/* ── Cart Bar ── */}
      {cartCount > 0 && isOrderingEnabled && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 150,
            maxWidth: 480,
            margin: '0 auto',
            padding: '12px 16px 24px',
            background: 'transparent',
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={() => setShowCart(true)}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              background: 'var(--accent)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 15,
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(45,122,74,0.35)',
              pointerEvents: 'auto',
            }}
          >
            <span
              style={{
                background: 'rgba(255,255,255,0.25)',
                padding: '2px 9px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {cartCount} item{cartCount !== 1 ? 's' : ''}
            </span>
            <span>View order</span>
            <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{formatINR(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* ── Cart Drawer ── */}
      {showCart && (
        <CartDrawer
          onClose={() => setShowCart(false)}
          onCheckout={() => {
            setShowCart(false);
            if (!isRestaurantOpen) {
              setShowClosedWarning(true);
            } else {
              setShowCheckout(true);
            }
          }}
        />
      )}

      {/* ── Closed Warning ── */}
      {showClosedWarning && (
        <ClosedOrderWarning
          onPlaceAnyway={() => {
            setShowClosedWarning(false);
            setShowCheckout(true);
          }}
          onCancel={() => setShowClosedWarning(false)}
        />
      )}

      {/* ── Checkout Sheet ── */}
      {showCheckout && (
        <CheckoutSheet
          qrSlug={slug}
          isTakeaway={isTakeaway}
          onClose={() => setShowCheckout(false)}
          onSuccess={(order) => {
            setShowCheckout(false);
            setPlacedOrder(order);
          }}
          onOrderingPaused={(reason) => {
            setShowCheckout(false);
            setLocalPausedReason(reason || 'Ordering is temporarily paused');
          }}
        />
      )}
    </div>
  );
}
