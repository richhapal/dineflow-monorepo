'use client';
import { useState, useMemo } from 'react';
import { useItems, useCategories } from '@/hooks/useMenu';
import { ItemCard } from './ItemCard';
import { MenuEmptyState } from './MenuEmptyState';
import type { MenuItem } from '@dineflow/types';
import { FoodType } from '@dineflow/types';

const FILTER_PILLS: { id: string; label: string; icon?: string; color?: string }[] = [
  { id: 'All',      label: 'All' },
  { id: 'Available',label: 'Available', icon: '●', color: '#4A7C59' },
  { id: 'Hidden',   label: 'Hidden',    icon: '●', color: '#aaa' },
  { id: 'VEG',      label: 'Veg',       icon: '▣', color: '#4A7C59' },
  { id: 'VEGAN',    label: 'Vegan',     icon: '▣', color: '#1D7A4A' },
  { id: 'NON-VEG',  label: 'Non-veg',   icon: '▲', color: '#993C1D' },
];
type Filter = 'All' | 'Available' | 'Hidden' | 'VEG' | 'VEGAN' | 'NON-VEG';

interface Props {
  categoryId: string;
  onEditItem: (item: MenuItem) => void;
  onNewItem: () => void;
}

function SkeletonCard() {
  return (
    <div style={{ height: 120, borderRadius: 10, background: 'linear-gradient(90deg, var(--paper3) 25%, var(--paper2) 50%, var(--paper3) 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
  );
}

export function ItemGrid({ categoryId, onEditItem, onNewItem }: Props) {
  const { data: items, isLoading } = useItems(categoryId);
  const { data: categories } = useCategories();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');

  const category = categories?.find(c => c.id === categoryId);

  const filtered = useMemo(() => {
    let list = items || [];
    if (search) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()));
    if (activeFilter === 'Available') list = list.filter(i => i.is_available);
    if (activeFilter === 'Hidden')    list = list.filter(i => !i.is_available);
    if (activeFilter === 'VEG')       list = list.filter(i => i.food_type === FoodType.VEG);
    if (activeFilter === 'VEGAN')     list = list.filter(i => i.food_type === FoodType.VEGAN);
    if (activeFilter === 'NON-VEG')   list = list.filter(i => i.food_type === FoodType.NON_VEG || i.food_type === FoodType.EGG);
    return list;
  }, [items, search, activeFilter]);

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
      <div style={{ flex: 1, padding: 24, overflowY: 'auto', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 22, color: 'var(--ink)' }}>
              {category?.name || ''}
            </span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)', marginLeft: 8 }}>
              {items?.length ?? 0} items
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{ width: 200, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: "'Geist', sans-serif", fontSize: 13, outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(184,92,44,.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
            <button
              onClick={onNewItem}
              style={{ padding: '9px 18px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--ink)')}
            >+ Add item</button>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTER_PILLS.map(f => {
            const active = activeFilter === f.id;
            return (
              <button key={f.id} onClick={() => setActiveFilter(f.id as Filter)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 100, border: '1px solid',
                borderColor: active ? 'transparent' : 'var(--border)',
                background: active ? 'var(--ink)' : 'var(--paper3)',
                color: active ? '#fff' : 'var(--ink3)',
                fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer',
                transition: 'all .15s',
              }}>
                {f.icon && (
                  <span style={{ fontSize: f.icon === '▣' ? 10 : 8, color: active ? '#fff' : f.color, lineHeight: 1 }}>
                    {f.icon}
                  </span>
                )}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !items || items.length === 0 ? (
          <MenuEmptyState type="no-items" onAction={onNewItem} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {filtered.map(item => (
              <ItemCard key={item.id} item={item} categoryId={categoryId} onEdit={onEditItem} />
            ))}

            {/* Add new item card */}
            <div
              onClick={onNewItem}
              style={{ border: '1.5px dashed var(--border2)', borderRadius: 'var(--radius)', minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', transition: 'all .18s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; (e.currentTarget.querySelector('.add-icon') as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget.querySelector('.add-text') as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'transparent'; (e.currentTarget.querySelector('.add-icon') as HTMLElement).style.color = 'var(--ink5)'; (e.currentTarget.querySelector('.add-text') as HTMLElement).style.color = 'var(--ink4)'; }}
            >
              <span className="add-icon" style={{ fontSize: 24, color: 'var(--ink5)', transition: 'color .18s' }}>+</span>
              <span className="add-text" style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)', transition: 'color .18s' }}>Add new item</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
