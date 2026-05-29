'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useDeleteItem, useCreateItem } from '@/hooks/useMenu';
import { AvailabilityToggle } from './AvailabilityToggle';
import { formatINR } from '@dineflow/utils';
import { menuImage, isR2Image } from '@/lib/imageUrl';
import { useToast } from '@/components/ui/Toast';
import type { MenuItem } from '@dineflow/types';
import { FoodType } from '@dineflow/types';

const FOOD_TYPE_COLORS: Record<FoodType, string> = {
  [FoodType.VEG]:              '#4A7C59',
  [FoodType.NON_VEG]:          '#993C1D',
  [FoodType.VEGAN]:            '#1D7A4A',
  [FoodType.EGG]:              '#B85C2C',
  [FoodType.CONTAINS_ALCOHOL]: '#7B5EA7',
};

interface Props {
  item: MenuItem;
  categoryId: string;
  onEdit: (item: MenuItem) => void;
}

export function ItemCard({ item, categoryId, onEdit }: Props) {
  const { showToast } = useToast();
  const deleteItem = useDeleteItem();
  const createItem = useCreateItem();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleDelete = () => {
    deleteItem.mutate({ id: item.id, categoryId }, {
      onSuccess: () => { showToast({ type: 'success', title: 'Item deleted' }); setShowDeleteConfirm(false); },
      onError: () => showToast({ type: 'error', title: 'Delete failed' }),
    });
  };

  const handleDuplicate = () => {
    const { id, created_at, updated_at, translations, variants, addon_groups, ...rest } = item as MenuItem & { created_at: string; updated_at: string };
    createItem.mutate({ ...rest, name: `${item.name} (copy)`, category_id: categoryId }, {
      onSuccess: () => showToast({ type: 'success', title: 'Item duplicated' }),
    });
    setShowDropdown(false);
  };

  return (
    <div
      onClick={() => onEdit(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowDropdown(false); }}
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 14,
        display: 'flex',
        gap: 14,
        cursor: 'pointer',
        transition: 'border-color .18s, box-shadow .18s',
        position: 'relative',
        opacity: item.is_available ? 1 : 0.6,
        borderColor: hovered ? 'var(--border2)' : 'var(--border)',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,.05)' : 'none',
      }}
    >
      {/* Bestseller badge */}
      {item.is_bestseller && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
          borderRadius: 100, fontSize: 10, fontWeight: 500, color: 'var(--accent)',
          padding: '2px 8px', fontFamily: "'Geist', sans-serif",
        }}>★ Bestseller</div>
      )}

      {/* Image */}
      <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
        {isR2Image(item.image_public_id) ? (
          <Image
            src={menuImage(item.image_public_id!)}
            alt={item.name}
            width={80} height={80}
            style={{ objectFit: 'cover', borderRadius: 8 }}
          />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 8, background: 'var(--paper3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: 'var(--ink4)' }}>
              {item.name[0]}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, minWidth: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FOOD_TYPE_COLORS[item.food_type] || '#888', flexShrink: 0 }} />
          <span style={{
            fontFamily: "'Instrument Serif', serif", fontSize: 16, color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>
            {item.name}
          </span>
        </div>

        {/* Description — max 2 lines then ellipsis */}
        <p style={{
          fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 12, color: 'var(--ink4)',
          marginBottom: 6,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: '1.4',
          maxHeight: '2.8em',        /* 2 lines × 1.4 line-height */
          wordBreak: 'break-word',
        }}>
          {item.description || '—'}
        </p>

        {/* Price — show default variant price if variants exist */}
        {(() => {
          const defaultVariant = item.variants?.find(v => v.is_default);
          const displayPrice = defaultVariant ? Number(defaultVariant.price) : item.base_price;
          const variantCount = item.variants?.length ?? 0;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                {formatINR(displayPrice)}
              </span>
              {variantCount > 0 && (
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)' }}>
                  {defaultVariant ? `${variantCount} sizes` : `+ ${variantCount} sizes`}
                </span>
              )}
            </div>
          );
        })()}

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div onClick={e => e.stopPropagation()}>
            <AvailabilityToggle item={item} categoryId={categoryId} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onEdit(item)}
              style={{ padding: '4px 10px', border: '1px solid var(--border2)', borderRadius: 6, background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink3)', cursor: 'pointer' }}
            >Edit</button>

            {/* ⋮ dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDropdown(p => !p)}
                style={{ width: 26, height: 26, border: '1px solid var(--border2)', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--ink4)' }}
              >⋮</button>
              {showDropdown && (
                <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.1)', minWidth: 140, overflow: 'hidden', marginTop: 4 }}>
                  <button onClick={() => { onEdit(item); setShowDropdown(false); }} style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >Edit</button>
                  <button onClick={handleDuplicate} style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >Duplicate</button>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
                  <button onClick={() => { setShowDeleteConfirm(true); setShowDropdown(false); }} style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--red)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >Delete</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 'var(--radius)', padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 5, border: '1.5px solid var(--red-bg)' }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>Delete this item?</p>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)', marginBottom: 12 }}>Orders that included it will still show the item name.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border2)', borderRadius: 6, background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleteItem.isPending} style={{ flex: 1, padding: '6px 10px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 6, fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer' }}>
              {deleteItem.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
