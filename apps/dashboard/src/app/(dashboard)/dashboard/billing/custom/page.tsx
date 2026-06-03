'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDashboardStore } from '@/lib/store';
import { formatINR } from '@dineflow/utils';

// ─── Discount preset type ─────────────────────────────────────────────────────

interface DiscountPreset {
  id: string;
  name: string;
  type: string;          // 'PERCENTAGE' | 'FIXED_AMOUNT'
  value: number;
  max_discount_cap?: number | null;
  min_order_amount?: number | null;
}

interface AppliedDiscount {
  kind: 'preset' | 'coupon';
  id?: string;           // for preset
  code?: string;         // for coupon
  name: string;
  serverAmount: number;  // server-computed ₹ saving (for coupons)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuVariant { id: string; name: string; price: number; is_default: boolean }
interface MenuItem {
  id: string; name: string; base_price: number; food_type: string;
  is_available: boolean; category_id: string; variants: MenuVariant[];
}
interface MenuCategory { id: string; name: string; menuItems: MenuItem[] }
interface Table { id: string; name: string; section?: string }

interface CartItem {
  key: string;                 // unique: menu_item_id+variant_id or custom-uuid
  menu_item_id: string | null; // null = free-form item
  item_name: string;
  unit_price: number;
  quantity: number;
  notes: string;
  variant_id?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const sans  = { fontFamily: "'Geist', sans-serif" } as const;
const mono  = { fontFamily: "'Geist Mono', monospace" } as const;
const serif = { fontFamily: "'Instrument Serif', serif" } as const;

const FOOD_COLOR: Record<string, string> = {
  VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#15803d', EGG: '#d97706',
};

const ORDER_TYPES = [
  { value: 'DINE_IN',      label: '🍽 Dine-in' },
  { value: 'TAKEAWAY',     label: '📦 Takeaway' },
  { value: 'WAITER_PLACED', label: '🧾 Direct' },
];

const PAYMENT_METHODS = [
  { value: 'CASH',          label: '💵 Cash' },
  { value: 'UPI',           label: '📱 UPI' },
  { value: 'CARD',          label: '💳 Card' },
  { value: 'COMPLIMENTARY', label: '🎁 Comp.' },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function FoodDot({ type }: { type: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      border: `1.5px solid ${FOOD_COLOR[type] ?? '#888'}`,
      background: type === 'VEG' || type === 'VEGAN' ? FOOD_COLOR[type] : 'transparent',
      flexShrink: 0,
    }} />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomBillPage() {
  const router = useRouter();
  const { restaurant } = useDashboardStore();

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery<MenuCategory[]>({
    queryKey: ['menu-categories-custom'],
    queryFn: () => api.get('/menu/categories').then(r => r.data),
  });

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ['tables-custom'],
    queryFn: () => api.get('/tables').then(r => r.data),
  });

  const { data: presets = [] } = useQuery<DiscountPreset[]>({
    queryKey: ['discount-presets'],
    queryFn: () => api.get('/discounts/presets').then(r => r.data),
  });

  // ── Menu search / browse state ────────────────────────────────────────
  const [menuSearch, setMenuSearch] = useState('');
  const [openCat, setOpenCat] = useState<string | null>(null);

  // ── Custom item entry ─────────────────────────────────────────────────
  const [customName, setCustomName]   = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty]     = useState('1');
  const [customNote, setCustomNote]   = useState('');
  const [customErr, setCustomErr]     = useState('');

  // ── Cart ──────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Customer / order details ──────────────────────────────────────────
  const [custName,  setCustName]  = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [tableId,   setTableId]   = useState('');
  const [orderType, setOrderType] = useState('WAITER_PLACED');
  const [covers,    setCovers]    = useState('1');
  const [billNote,  setBillNote]  = useState('');

  // ── Discount state ────────────────────────────────────────────────────────
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [manualDiscount,  setManualDiscount]  = useState('');  // flat ₹ fallback
  const [couponInput,     setCouponInput]     = useState('');
  const [couponLoading,   setCouponLoading]   = useState(false);
  const [couponError,     setCouponError]     = useState('');

  // ── Payment ────────────────────────────────────────────────────────────
  const [payNow,   setPayNow]   = useState(false);
  const [payMethod, setPayMethod] = useState('CASH');
  const [upiTxn,  setUpiTxn]   = useState('');

  // ── Submission state ──────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');

  // ── Derived totals ────────────────────────────────────────────────────
  const gstRate  = Number(restaurant?.gst_rate ?? 0.05);
  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const cgst     = parseFloat((subtotal * gstRate / 2).toFixed(2));
  const sgst     = parseFloat((subtotal * gstRate / 2).toFixed(2));
  const gross    = subtotal + cgst + sgst;

  // Compute client-side discount preview
  const discountAmt = (() => {
    if (appliedDiscount) {
      if (appliedDiscount.kind === 'coupon') return Math.min(appliedDiscount.serverAmount, gross);
      // preset: compute locally
      const p = presets.find(x => x.id === appliedDiscount.id);
      if (!p) return 0;
      let amt = p.type === 'PERCENTAGE' ? (subtotal * p.value) / 100 : p.value;
      if (p.max_discount_cap) amt = Math.min(amt, p.max_discount_cap);
      return parseFloat(Math.min(amt, gross).toFixed(2));
    }
    const manual = Math.max(parseFloat(manualDiscount || '0') || 0, 0);
    return Math.min(manual, gross);
  })();

  const total = parseFloat((gross - discountAmt).toFixed(2));

  // ── Filtered menu items ────────────────────────────────────────────────
  const filteredCats = useMemo(() => {
    const q = menuSearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.map(cat => ({
      ...cat,
      menuItems: cat.menuItems.filter(
        i => i.is_available && i.name.toLowerCase().includes(q),
      ),
    })).filter(c => c.menuItems.length > 0);
  }, [categories, menuSearch]);

  // ── Cart helpers ──────────────────────────────────────────────────────
  const addMenuItem = useCallback((item: MenuItem, variant?: MenuVariant) => {
    const price = variant ? variant.price : item.base_price;
    const key   = variant ? `${item.id}:${variant.id}` : item.id;
    setCart(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.map(c => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        key, menu_item_id: item.id, item_name: item.name + (variant ? ` (${variant.name})` : ''),
        unit_price: Number(price), quantity: 1, notes: '', variant_id: variant?.id ?? null,
      }];
    });
  }, []);

  const removeFromCart = (key: string) => setCart(p => p.filter(c => c.key !== key));

  const updateQty = (key: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.key === key ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
      .filter(c => c.quantity > 0),
    );
  };

  const setQtyDirect = (key: string, val: string) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n <= 0) { setCart(p => p.filter(c => c.key !== key)); return; }
    setCart(p => p.map(c => c.key === key ? { ...c, quantity: n } : c));
  };

  const updateItemNote = (key: string, note: string) =>
    setCart(p => p.map(c => c.key === key ? { ...c, notes: note } : c));

  const cartQty = (key: string) => cart.find(c => c.key === key)?.quantity ?? 0;

  // ── Add custom item ────────────────────────────────────────────────────
  const handleAddCustom = () => {
    setCustomErr('');
    const name  = customName.trim();
    const price = parseFloat(customPrice);
    const qty   = parseInt(customQty, 10);
    if (!name)               return setCustomErr('Item name is required');
    if (isNaN(price) || price < 0) return setCustomErr('Enter a valid price (≥ 0)');
    if (isNaN(qty)   || qty <= 0)  return setCustomErr('Quantity must be ≥ 1');
    const key = `custom-${uid()}`;
    setCart(prev => [...prev, {
      key, menu_item_id: null, item_name: name,
      unit_price: price, quantity: qty, notes: customNote.trim(),
    }]);
    setCustomName(''); setCustomPrice(''); setCustomQty('1'); setCustomNote('');
  };

  // ── Apply coupon code ──────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    setCouponLoading(true);
    try {
      const res = await api.post('/discounts/validate', { code, order_amount: subtotal });
      const { discount, discount_amount } = res.data;
      setAppliedDiscount({
        kind: 'coupon',
        code: discount.code ?? code,
        name: discount.name,
        serverAmount: discount_amount,
      });
      setCouponInput('');
    } catch (e: any) {
      setCouponError(e?.response?.data?.message || 'Invalid coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  // ── Apply preset ───────────────────────────────────────────────────────
  const handleApplyPreset = (preset: DiscountPreset) => {
    if (appliedDiscount?.id === preset.id) {
      setAppliedDiscount(null); // toggle off
    } else {
      setAppliedDiscount({ kind: 'preset', id: preset.id, name: preset.name, serverAmount: 0 });
      setManualDiscount('');
    }
    setCouponError('');
  };

  // ── Validate phone ─────────────────────────────────────────────────────
  const phoneValid = !custPhone || /^\d{10}$/.test(custPhone.replace(/\s/g, ''));
  const gstinValid = !custGstin || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(custGstin.toUpperCase());

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setSubmitErr('');
    if (cart.length === 0) { setSubmitErr('Add at least one item'); return; }
    if (!phoneValid)       { setSubmitErr('Phone must be 10 digits'); return; }
    if (!gstinValid)       { setSubmitErr('Invalid GSTIN format'); return; }
    const coversNum = parseInt(covers, 10);
    if (isNaN(coversNum) || coversNum < 1) { setSubmitErr('Covers must be ≥ 1'); return; }

    setSubmitting(true);
    try {
      // Build discount fields — only one of: discount_id, coupon_code, discount_amount
      const discountFields: Record<string, unknown> = {};
      if (appliedDiscount?.kind === 'preset' && appliedDiscount.id) {
        discountFields.discount_id = appliedDiscount.id;
      } else if (appliedDiscount?.kind === 'coupon' && appliedDiscount.code) {
        discountFields.coupon_code = appliedDiscount.code;
      } else {
        const manual = Math.max(parseFloat(manualDiscount || '0') || 0, 0);
        if (manual > 0) discountFields.discount_amount = manual;
      }

      const res = await api.post('/billing/custom', {
        customer_name:   custName.trim() || undefined,
        customer_phone:  custPhone.trim() || undefined,
        customer_gstin:  custGstin.trim().toUpperCase() || undefined,
        table_id:        tableId || undefined,
        order_type:      orderType,
        covers:          coversNum,
        notes:           billNote.trim() || undefined,
        items: cart.map(c => ({
          menu_item_id: c.menu_item_id ?? undefined,
          item_name:    c.item_name,
          quantity:     c.quantity,
          unit_price:   c.unit_price,
          notes:        c.notes || undefined,
        })),
        ...discountFields,
        payment_method:  payNow ? payMethod : undefined,
        upi_txn_id:      (payNow && payMethod === 'UPI' && upiTxn.trim()) ? upiTxn.trim() : undefined,
      });
      router.push(`/dashboard/billing?bill=${res.data.id}`);
    } catch (e: any) {
      setSubmitErr(e?.response?.data?.message || 'Failed to create bill. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    ...sans, width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', fontSize: 13, color: 'var(--ink)',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--paper, #fafaf9)' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        background: '#fff', display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button
          onClick={() => router.push('/dashboard/billing')}
          style={{ ...sans, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink4)' }}
        >
          ← Back
        </button>
        <h1 style={{ ...serif, fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', margin: 0 }}>
          Custom Bill
        </h1>
        <span style={{ ...sans, fontSize: 12, color: 'var(--ink4)', marginLeft: 4 }}>
          Build a bill directly — no app needed
        </span>
      </div>

      {/* ── Two-panel body ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 400px',
        gap: 0, height: 'calc(100vh - 113px)',
      }}>

        {/* ════════════════════════════════════ LEFT PANEL ═══════ */}
        <div style={{
          overflowY: 'auto', borderRight: '1px solid var(--border)',
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* ── Search ── */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, color: 'var(--ink4)',
            }}>🔍</span>
            <input
              placeholder="Search menu items…"
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>

          {/* ── Menu categories ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredCats.length === 0 && (
              <p style={{ ...sans, fontSize: 13, color: 'var(--ink4)', textAlign: 'center', padding: '20px 0' }}>
                {menuSearch ? 'No items match your search' : 'No menu items available'}
              </p>
            )}
            {filteredCats.map(cat => {
              const isOpen = menuSearch ? true : openCat === cat.id;
              const available = cat.menuItems.filter(i => i.is_available);
              if (available.length === 0) return null;
              return (
                <div key={cat.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Category header */}
                  <button
                    onClick={() => setOpenCat(isOpen ? null : cat.id)}
                    style={{
                      ...sans, width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', padding: '10px 16px',
                      background: isOpen ? 'var(--paper2)' : '#fff',
                      border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                    }}
                  >
                    <span>{cat.name}</span>
                    <span style={{ color: 'var(--ink4)', fontSize: 11 }}>
                      {available.length} item{available.length !== 1 ? 's' : ''} {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Items grid */}
                  {isOpen && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 8, padding: '10px 12px', background: 'var(--paper)',
                    }}>
                      {available.map(item => {
                        // If item has variants, show each variant as a separate card
                        const cards = item.variants.length > 0
                          ? item.variants.filter(v => v.is_default || item.variants.length <= 4).map(v => ({ item, variant: v }))
                          : [{ item, variant: undefined }];

                        return cards.map(({ variant }) => {
                          const key   = variant ? `${item.id}:${variant.id}` : item.id;
                          const price = variant ? Number(variant.price) : Number(item.base_price);
                          const inCart = cartQty(key);
                          return (
                            <div
                              key={key}
                              style={{
                                background: inCart > 0 ? '#EFF6FF' : '#fff',
                                border: inCart > 0 ? '1.5px solid #93C5FD' : '1px solid var(--border)',
                                borderRadius: 8, padding: '10px 12px',
                                display: 'flex', flexDirection: 'column', gap: 6,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1 }}>
                                  <FoodDot type={item.food_type} />
                                  <span style={{ ...sans, fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                                    {item.name}{variant ? ` · ${variant.name}` : ''}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>
                                  ₹{price.toFixed(0)}
                                </span>
                                {inCart === 0 ? (
                                  <button
                                    onClick={() => addMenuItem(item, variant)}
                                    style={{
                                      ...sans, padding: '4px 12px', borderRadius: 6,
                                      background: 'var(--ink)', color: '#fff',
                                      border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    }}
                                  >
                                    + Add
                                  </button>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button onClick={() => updateQty(key, -1)} style={qBtnStyle}>−</button>
                                    <span style={{ ...mono, fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{inCart}</span>
                                    <button onClick={() => updateQty(key, +1)} style={qBtnStyle}>+</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Custom / free-form item entry ── */}
          <div style={{
            background: '#fff', border: '1.5px dashed var(--border2)',
            borderRadius: 10, padding: '16px 18px',
          }}>
            <p style={{ ...sans, fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
              ＋ Add custom item
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 64px', gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Item name (e.g. Packing charge)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="₹ Price"
                type="number"
                min="0"
                step="0.5"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Qty"
                type="number"
                min="1"
                value={customQty}
                onChange={e => setCustomQty(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: customErr ? 8 : 0 }}>
              <input
                placeholder="Note (optional)"
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleAddCustom}
                style={{
                  ...sans, padding: '8px 18px', borderRadius: 8,
                  background: 'var(--ink)', color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Add
              </button>
            </div>
            {customErr && (
              <p style={{ ...sans, fontSize: 12, color: '#dc2626', marginTop: 4 }}>{customErr}</p>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════ RIGHT PANEL ══════ */}
        <div style={{
          overflowY: 'auto', background: '#fff',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* ── Customer details ── */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ ...sans, fontSize: 11, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              Customer Details
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="Customer name (optional)" value={custName}
                onChange={e => setCustName(e.target.value)} style={inputStyle} />
              <div style={{ position: 'relative' }}>
                <input placeholder="Phone — 10 digits (optional)" value={custPhone}
                  onChange={e => setCustPhone(e.target.value)} style={{
                    ...inputStyle,
                    borderColor: custPhone && !phoneValid ? '#dc2626' : undefined,
                  }} />
                {custPhone && !phoneValid && (
                  <span style={{ ...sans, position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#dc2626' }}>
                    10 digits
                  </span>
                )}
              </div>
              <input placeholder="GSTIN (B2B, optional)" value={custGstin}
                onChange={e => setCustGstin(e.target.value.toUpperCase())} style={{
                  ...inputStyle,
                  borderColor: custGstin && !gstinValid ? '#dc2626' : undefined,
                }} />
            </div>
          </div>

          {/* ── Order meta ── */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ ...sans, fontSize: 11, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              Order Details
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {ORDER_TYPES.map(t => (
                <button key={t.value} onClick={() => setOrderType(t.value)} style={{
                  ...sans, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: orderType === t.value ? '1.5px solid var(--ink)' : '1px solid var(--border)',
                  background: orderType === t.value ? 'var(--ink)' : '#fff',
                  color: orderType === t.value ? '#fff' : 'var(--ink4)', cursor: 'pointer',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
              <select value={tableId} onChange={e => setTableId(e.target.value)} style={{ ...inputStyle }}>
                <option value="">No table / Takeaway</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.section ? ` (${t.section})` : ''}</option>
                ))}
              </select>
              <input type="number" min="1" max="50" placeholder="Covers" value={covers}
                onChange={e => setCovers(e.target.value)} style={inputStyle} />
            </div>
            <input placeholder="Order note (optional)" value={billNote}
              onChange={e => setBillNote(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} />
          </div>

          {/* ── Cart ── */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flex: 1 }}>
            <p style={{ ...sans, fontSize: 11, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              Items · {cart.length}
            </p>

            {cart.length === 0 ? (
              <div style={{
                padding: '32px 0', textAlign: 'center', border: '1.5px dashed var(--border)',
                borderRadius: 8,
              }}>
                <p style={{ fontSize: 24, marginBottom: 6 }}>🛒</p>
                <p style={{ ...sans, fontSize: 13, color: 'var(--ink4)' }}>
                  Add items from the menu on the left
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cart.map(item => (
                  <div key={item.key} style={{
                    background: 'var(--paper)', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      {/* Name + remove */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...sans, fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                          {item.item_name}
                          {item.menu_item_id === null && (
                            <span style={{ ...sans, marginLeft: 6, fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 4 }}>
                              Custom
                            </span>
                          )}
                        </p>
                        <p style={{ ...mono, fontSize: 11, color: 'var(--ink4)' }}>
                          ₹{item.unit_price.toFixed(2)} each
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.key)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink4)', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* Qty control */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateQty(item.key, -1)} style={qBtnStyle}>−</button>
                        <input
                          type="number" min="1" value={item.quantity}
                          onChange={e => setQtyDirect(item.key, e.target.value)}
                          style={{ ...mono, width: 40, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 0', fontSize: 13, fontWeight: 700 }}
                        />
                        <button onClick={() => updateQty(item.key, +1)} style={qBtnStyle}>+</button>
                      </div>
                      <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        ₹{(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                    {/* Inline note */}
                    <input
                      placeholder="Note for this item…"
                      value={item.notes}
                      onChange={e => updateItemNote(item.key, e.target.value)}
                      style={{ ...sans, marginTop: 6, width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, color: 'var(--ink4)', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Discount ── */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ ...sans, fontSize: 11, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              Discount
            </p>

            {/* Applied discount badge */}
            {appliedDiscount && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#F0FDF4', border: '1px solid #86EFAC',
                borderRadius: 8, padding: '8px 12px', marginBottom: 10,
              }}>
                <div>
                  <span style={{ ...sans, fontSize: 12, fontWeight: 600, color: '#166534' }}>
                    {appliedDiscount.kind === 'coupon' ? '🎟' : '⚡'} {appliedDiscount.name}
                  </span>
                  {appliedDiscount.kind === 'coupon' && appliedDiscount.code && (
                    <span style={{ ...sans, fontSize: 11, color: '#15803D', marginLeft: 6, background: '#DCFCE7', padding: '1px 7px', borderRadius: 10 }}>
                      {appliedDiscount.code}
                    </span>
                  )}
                  {discountAmt > 0 && (
                    <p style={{ ...sans, fontSize: 11, color: '#15803D', marginTop: 2 }}>
                      −₹{discountAmt.toFixed(2)} saved
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setAppliedDiscount(null)}
                  style={{ ...sans, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#86EFAC', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Quick preset chips */}
            {!appliedDiscount && presets.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {presets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      ...sans, padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: '#fff', color: 'var(--ink3)',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    ⚡ {p.name} ({p.type === 'PERCENTAGE' ? `${p.value}%` : `₹${p.value}`})
                  </button>
                ))}
              </div>
            )}

            {/* Coupon code input */}
            {!appliedDiscount && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    placeholder="Coupon code"
                    value={couponInput}
                    onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                    style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    style={{
                      ...sans, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: couponInput.trim() ? 'var(--ink)' : 'var(--paper2)',
                      color: couponInput.trim() ? '#fff' : 'var(--ink5)',
                      border: 'none', cursor: couponInput.trim() ? 'pointer' : 'default',
                      opacity: couponLoading ? 0.6 : 1, whiteSpace: 'nowrap',
                    }}
                  >
                    {couponLoading ? '…' : 'Apply'}
                  </button>
                </div>
                {couponError && (
                  <p style={{ ...sans, fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠ {couponError}</p>
                )}
              </div>
            )}

            {/* Manual flat discount (only shown when nothing else applied) */}
            {!appliedDiscount && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ ...sans, fontSize: 12, color: 'var(--ink4)' }}>Or manual flat discount (₹)</span>
                <input
                  type="number" min="0" step="0.5" placeholder="0"
                  value={manualDiscount}
                  onChange={e => setManualDiscount(e.target.value)}
                  style={{ ...mono, width: 80, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: '#dc2626' }}
                />
              </div>
            )}
          </div>

          {/* ── Totals ── */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...mono, fontSize: 12 }}>
              {[
                { label: 'Subtotal', value: subtotal },
                ...(cgst > 0 ? [
                  { label: `CGST ${(gstRate * 50).toFixed(1)}%`, value: cgst },
                  { label: `SGST ${(gstRate * 50).toFixed(1)}%`, value: sgst },
                ] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink4)' }}>
                  <span>{label}</span><span>₹{value.toFixed(2)}</span>
                </div>
              ))}
              {discountAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                  <span>Discount</span><span>−₹{discountAmt.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
              ...mono, fontWeight: 700, fontSize: 16, color: 'var(--ink)',
            }}>
              <span>TOTAL</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          {/* ── Payment ── */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              ...sans, fontSize: 13, fontWeight: 600, color: 'var(--ink)',
            }}>
              <input type="checkbox" checked={payNow} onChange={e => setPayNow(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              Collect payment now
            </label>

            {payNow && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value} onClick={() => setPayMethod(m.value)} style={{
                      ...sans, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      border: payMethod === m.value ? '1.5px solid var(--ink)' : '1px solid var(--border)',
                      background: payMethod === m.value ? 'var(--ink)' : '#fff',
                      color: payMethod === m.value ? '#fff' : 'var(--ink4)', cursor: 'pointer',
                    }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {payMethod === 'UPI' && (
                  <input
                    placeholder="UPI Transaction ID (optional)"
                    value={upiTxn}
                    onChange={e => setUpiTxn(e.target.value)}
                    style={inputStyle}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Generate button ── */}
          <div style={{ padding: '16px 20px' }}>
            {submitErr && (
              <div style={{
                ...sans, fontSize: 12, color: '#dc2626', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 10,
              }}>
                ⚠ {submitErr}
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={submitting || cart.length === 0}
              style={{
                ...sans, width: '100%', padding: '12px', borderRadius: 10,
                background: submitting || cart.length === 0 ? 'var(--ink4)' : 'var(--ink)',
                color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
                cursor: submitting || cart.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? '⏳ Generating…' : payNow
                ? `💰 Generate & Collect ${formatINR(total)}`
                : '🧾 Generate Bill'}
            </button>
            {cart.length === 0 && (
              <p style={{ ...sans, fontSize: 11, color: 'var(--ink4)', textAlign: 'center', marginTop: 6 }}>
                Add items to enable
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Small shared button style for qty controls
const qBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)',
  background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--ink)', padding: 0, lineHeight: 1,
};
