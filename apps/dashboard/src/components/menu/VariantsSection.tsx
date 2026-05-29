'use client';
import { useState, useEffect } from 'react';
import { useUpdateItem } from '@/hooks/useMenu';
import type { MenuItemVariant } from '@dineflow/types';

interface Props {
  itemId: string | undefined;
  variants: MenuItemVariant[];
}

type LocalVariant = Omit<MenuItemVariant, 'item_id'> & { item_id?: string };

function newVariant(sortOrder: number): LocalVariant {
  return {
    id: `new-${Math.random().toString(36).slice(2)}`,
    name: '',
    price: 0,
    is_default: false,
    is_available: true,
    sort_order: sortOrder,
  };
}

export function VariantsSection({ itemId, variants }: Props) {
  const [local, setLocal] = useState<LocalVariant[]>(variants);
  const updateItem = useUpdateItem();

  // Only sync from server when not mid-save — avoids overwriting optimistic state
  useEffect(() => {
    if (!updateItem.isPending) setLocal(variants);
  }, [variants]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!itemId) return;
    const valid = local
      .filter(v => v.name.trim() && Number(v.price) >= 0)
      .map(({ id, name, price, is_default, is_available, sort_order }) => ({
        id,
        name,
        price: parseFloat(String(price)) || 0,   // Prisma Decimal comes back as string — force number
        is_default: is_default ?? false,
        is_available: is_available ?? true,
        sort_order: sort_order ?? 0,
      }));
    updateItem.mutate({ id: itemId, variants: valid as MenuItemVariant[] });
  };

  const setDefault = (id: string) => {
    const next = local.map(v => ({ ...v, is_default: v.id === id }));
    setLocal(next);
    if (!itemId) return;
    const valid = next
      .filter(v => v.name.trim() && Number(v.price) >= 0)
      .map(({ id: vid, name, price, is_default, is_available, sort_order }) => ({
        id: vid, name,
        price: parseFloat(String(price)) || 0,
        is_default: is_default ?? false,
        is_available: is_available ?? true,
        sort_order: sort_order ?? 0,
      }));
    updateItem.mutate({ id: itemId, variants: valid as MenuItemVariant[] });
  };

  const update = (id: string, field: keyof LocalVariant, value: string | number | boolean) => {
    setLocal(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const remove = (id: string) => {
    const next = local.filter(v => v.id !== id);
    setLocal(next);
    if (!itemId) return;
    const valid = next
      .filter(v => v.name.trim() && Number(v.price) >= 0)
      .map(({ id: vid, name, price, is_default, is_available, sort_order }) => ({
        id: vid, name,
        price: parseFloat(String(price)) || 0,
        is_default: is_default ?? false,
        is_available: is_available ?? true,
        sort_order: sort_order ?? 0,
      }));
    updateItem.mutate({ id: itemId, variants: valid as MenuItemVariant[] });
  };

  const addRow = () => setLocal(prev => [...prev, newVariant(prev.length)]);

  return (
    <div>
      <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
        Sizes &amp; variants
      </p>
      <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 12, color: 'var(--ink4)', marginBottom: 14 }}>
        Let customers choose between sizes or preparation options.
      </p>

      {local.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 32px', gap: 8, marginBottom: 6, padding: '0 2px' }}>
            {['Name', 'Price', 'Default', ''].map(h => (
              <span key={h} style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 600, color: 'var(--ink5)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</span>
            ))}
          </div>

          {local.map(v => (
            <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 32px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                value={v.name}
                placeholder="e.g. Regular"
                onChange={e => update(v.id, 'name', e.target.value)}
                onBlur={save}
                style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontFamily: "'Geist', sans-serif", fontSize: 13, outline: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <span style={{ padding: '7px 8px', background: 'var(--paper2)', fontFamily: "'Geist Mono', monospace", fontSize: 13, borderRight: '1px solid var(--border)' }}>₹</span>
                <input
                  type="number" min="0" step="0.01"
                  value={v.price}
                  onChange={e => update(v.id, 'price', parseFloat(e.target.value) || 0)}
                  onBlur={save}
                  style={{ flex: 1, border: 'none', padding: '7px 8px', fontFamily: "'Geist Mono', monospace", fontSize: 13, outline: 'none', width: 0 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div
                  onClick={() => setDefault(v.id)}
                  style={{
                    width: 34, height: 18, borderRadius: 9, cursor: 'pointer',
                    background: v.is_default ? '#2D7A4A' : 'var(--border2)',
                    position: 'relative', transition: 'background .2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2,
                    left: v.is_default ? 16 : 2,
                    width: 14, height: 14, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.15)',
                  }} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(v.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink5)', fontSize: 16, padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink5)')}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={addRow} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: "'Geist', sans-serif", fontSize: 13, padding: '2px 0', marginTop: 4 }}>
        + Add size
      </button>

      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)', marginTop: 12 }}>
        When variants exist, customers choose one before adding to cart. Base price is the default.
      </p>
    </div>
  );
}
