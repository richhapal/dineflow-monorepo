'use client';
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useItem, useCreateItem, useUpdateItem, useDeleteItem, useCategories, menuKeys,
} from '@/hooks/useMenu';
import { ImageUploader } from './ImageUploader';
import { FoodTypePicker } from './FoodTypePicker';
import { VariantsSection } from './VariantsSection';
import { AddonsSection } from './AddonsSection';
import { TranslationsTab } from './TranslationsTab';
import { useToast } from '@/components/ui/Toast';
import type { MenuItem } from '@dineflow/types';
import { FoodType } from '@dineflow/types';

type Tab = 'details' | 'variants' | 'addons' | 'translations';

interface Props {
  item: MenuItem | null;
  categoryId: string;
  onClose: () => void;
  onCreated?: (item: MenuItem) => void;
}

const COMMON_TAGS = ['spicy', 'bestseller', 'gluten-free', 'chef-special', 'seasonal', 'new'];

interface FormState {
  name: string;
  description: string;
  base_price: string;
  category_id: string;
  food_type: FoodType;
  tags: string[];
  calories: string;
  prep_time_mins: string;
  is_available: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  image_public_id: string | null;
}

export function ItemDrawer({ item, categoryId, onClose, onCreated }: Props) {
  const { showToast } = useToast();
  const qc = useQueryClient();
  // useItem only needed for variants/addonGroups/translations (extra relations)
  const { data: itemDetail } = useItem(item?.id ?? null);
  const { data: categories } = useCategories();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const [form, setForm] = useState<FormState>({
    name: '', description: '', base_price: '',
    category_id: categoryId,
    food_type: FoodType.VEG,
    tags: [], calories: '', prep_time_mins: '',
    is_available: true, is_featured: false, is_bestseller: false,
    image_public_id: null,
  });

  // Populate form immediately from the item prop (already available from the list)
  // This runs whenever the selected item changes — no waiting for a separate fetch
  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        description: item.description ?? '',
        base_price: String(item.base_price),
        category_id: item.category_id,
        food_type: item.food_type,
        tags: item.tags || [],
        calories: item.calories ? String(item.calories) : '',
        prep_time_mins: item.prep_time_mins ? String(item.prep_time_mins) : '',
        is_available: item.is_available,
        is_featured: item.is_featured,
        is_bestseller: item.is_bestseller,
        image_public_id: item.image_public_id ?? null,
      });
    } else {
      // New item — reset to defaults
      setForm({
        name: '', description: '', base_price: '',
        category_id: categoryId,
        food_type: FoodType.VEG,
        tags: [], calories: '', prep_time_mins: '',
        is_available: true, is_featured: false, is_bestseller: false,
        image_public_id: null,
      });
    }
    setActiveTab('details');
    setShowDeleteConfirm(false);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((field: keyof FormState, value: FormState[keyof FormState]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => set('tags', form.tags.filter(t => t !== tag));

  const handleSave = async () => {
    const trimmedName = form.name.trim();

    // ── Validation ────────────────────────────────────────────────────────────
    if (!trimmedName) {
      showToast({ type: 'error', title: 'Name required', message: 'Please enter a name for this item.' });
      return;
    }
    if (!form.base_price || isNaN(parseFloat(form.base_price)) || parseFloat(form.base_price) < 0) {
      showToast({ type: 'error', title: 'Valid price required', message: 'Enter a price of 0 or more.' });
      return;
    }

    // ── Duplicate name check — only when creating a new item ─────────────────
    if (!item) {
      const cachedItems = qc.getQueryData<MenuItem[]>(menuKeys.items(form.category_id)) ?? [];
      const duplicate = cachedItems.find(
        i => i.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        showToast({
          type: 'warning',
          title: 'Item already exists',
          message: `"${duplicate.name}" is already in this category.`,
        });
        return;
      }
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const payload = {
      name: trimmedName,
      description: form.description.trim() || undefined,
      base_price: parseFloat(form.base_price),
      category_id: form.category_id,
      food_type: form.food_type,
      tags: form.tags,
      calories: form.calories ? parseInt(form.calories) : undefined,
      prep_time_mins: form.prep_time_mins ? parseInt(form.prep_time_mins) : undefined,
      is_available: form.is_available,
      is_featured: form.is_featured,
      is_bestseller: form.is_bestseller,
    };

    try {
      if (item?.id) {
        await updateItem.mutateAsync({ id: item.id, ...payload });
        showToast({ type: 'success', title: 'Item saved', message: 'Changes are live on your menu.' });
        onClose();  // close drawer after successful update
      } else {
        const newItem = await createItem.mutateAsync(payload);
        showToast({ type: 'success', title: 'Item created', message: `"${newItem.name}" added to the menu.` });
        onCreated?.(newItem);
        onClose();  // close drawer after successful create — prevents accidental re-saves
      }
    } catch {
      showToast({ type: 'error', title: 'Save failed', message: 'Please try again.' });
    }
  };

  const handleDelete = () => {
    if (!item?.id) return;
    deleteItem.mutate({ id: item.id, categoryId }, {
      onSuccess: () => { showToast({ type: 'success', title: 'Item deleted' }); onClose(); },
      onError: () => showToast({ type: 'error', title: 'Delete failed' }),
    });
  };

  const isPending = createItem.isPending || updateItem.isPending;
  const TABS: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'variants', label: 'Variants' },
    { id: 'addons', label: 'Add-ons' },
    { id: 'translations', label: 'Translations' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>
          {item ? 'Edit item' : 'New item'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {item && (
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
              View on menu ↗
            </span>
          )}
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border2)', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'Geist', sans-serif", fontSize: 14,
            color: activeTab === tab.id ? 'var(--accent)' : 'var(--ink4)',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color .15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {activeTab === 'details' && (
          <div>
            <ImageUploader
              itemId={item?.id}
              publicId={form.image_public_id ?? itemDetail?.image_public_id}
              onUploaded={(key) => set('image_public_id', key)}
            />

            {/* Name */}
            <FieldGroup label="Name *">
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Truffle Risotto" style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </FieldGroup>

            {/* Category */}
            <FieldGroup label="Category">
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FieldGroup>

            {/* Description */}
            <FieldGroup label="Description">
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Short description shown on menu" style={{ ...inputStyle, resize: 'vertical' }} onFocus={focusStyle} onBlur={blurStyle} />
            </FieldGroup>

            {/* Price */}
            <FieldGroup label="Price *">
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <span style={{ padding: '10px 12px', background: 'var(--paper2)', fontFamily: "'Geist Mono', monospace", fontSize: 14, color: 'var(--ink3)', borderRight: '1px solid var(--border)' }}>₹</span>
                <input type="number" min="0" step="0.01" value={form.base_price} onChange={e => set('base_price', e.target.value)} placeholder="0.00" style={{ flex: 1, border: 'none', padding: '10px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 14, outline: 'none' }} />
              </div>
            </FieldGroup>

            {/* Food type */}
            <FieldGroup label="Food type">
              <FoodTypePicker value={form.food_type} onChange={v => set('food_type', v)} />
            </FieldGroup>

            {/* Tags */}
            <FieldGroup label="Tags">
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', minHeight: 44 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: form.tags.length ? 8 : 0 }}>
                  {form.tags.map(tag => (
                    <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 100, padding: '2px 8px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--accent)' }}>
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } if (e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="Type + Enter to add tag"
                  style={{ border: 'none', outline: 'none', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', width: '100%', background: 'transparent' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {COMMON_TAGS.filter(t => !form.tags.includes(t)).map(t => (
                  <button key={t} type="button" onClick={() => addTag(t)} style={{ padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border)', background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)', cursor: 'pointer' }}>
                    + {t}
                  </button>
                ))}
              </div>
            </FieldGroup>

            {/* Calories + Prep time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <FieldGroup label="Calories">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min="0" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="0" style={{ ...inputStyle, flex: 1 }} onFocus={focusStyle} onBlur={blurStyle} />
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink5)', flexShrink: 0 }}>kcal</span>
                </div>
              </FieldGroup>
              <FieldGroup label="Prep time">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min="0" value={form.prep_time_mins} onChange={e => set('prep_time_mins', e.target.value)} placeholder="0" style={{ ...inputStyle, flex: 1 }} onFocus={focusStyle} onBlur={blurStyle} />
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink5)', flexShrink: 0 }}>mins</span>
                </div>
              </FieldGroup>
            </div>

            {/* Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'is_featured', label: 'Mark as featured' },
                { key: 'is_bestseller', label: 'Mark as bestseller' },
                { key: 'is_available', label: 'Available on menu' },
              ] as const).map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form[key] as boolean} onChange={e => set(key, e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'variants' && (
          <VariantsSection itemId={item?.id} variants={itemDetail?.variants ?? []} />
        )}

        {activeTab === 'addons' && (
          <AddonsSection itemId={item?.id} addonGroups={itemDetail?.addon_groups ?? []} />
        )}

        {activeTab === 'translations' && (
          <TranslationsTab itemId={item?.id} />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0, background: '#fff' }}>
        {!showDeleteConfirm ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              style={{ flex: 1, height: 40, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .2s' }}
              onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = 'var(--accent)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--ink)'}
            >
              {isPending && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .6s linear infinite' }} />}
              {isPending ? (item ? 'Saving…' : 'Adding…') : (item ? 'Save changes' : 'Add item')}
            </button>
            {item && (
              <button type="button" onClick={() => setShowDeleteConfirm(true)} style={{ padding: '0 16px', height: 40, border: '1px solid var(--red-bg)', borderRadius: 8, background: 'transparent', color: 'var(--red)', fontFamily: "'Geist', sans-serif", fontSize: 13, cursor: 'pointer' }}>
                Delete
              </button>
            )}
          </>
        ) : (
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', marginBottom: 10 }}>Delete this item permanently?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, height: 36, border: '1px solid var(--border2)', borderRadius: 8, background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 13, cursor: 'pointer', color: 'var(--ink3)' }}>Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleteItem.isPending} style={{ flex: 1, height: 36, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Geist', sans-serif", fontSize: 13, cursor: 'pointer' }}>
                {deleteItem.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink2)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid var(--border)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};

function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--accent)';
  e.target.style.boxShadow = '0 0 0 3px rgba(184,92,44,.08)';
}
function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--border)';
  e.target.style.boxShadow = 'none';
}
