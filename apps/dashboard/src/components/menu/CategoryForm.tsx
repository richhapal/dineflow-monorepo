'use client';
import { useState, useEffect, useRef } from 'react';
import { useCreateCategory, useUpdateCategory } from '@/hooks/useMenu';
import { useToast } from '@/components/ui/Toast';
import type { MenuCategory } from '@dineflow/types';

interface Props {
  category?: MenuCategory | null;
  onClose: () => void;
}

export function CategoryForm({ category, onClose }: Props) {
  const { showToast } = useToast();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const isEditing = !!category;
  const isPending = createCategory.isPending || updateCategory.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEditing) {
      updateCategory.mutate({ id: category!.id, name: name.trim(), description: description.trim() || undefined, is_active: isActive }, {
        onSuccess: () => { showToast({ type: 'success', title: 'Category updated' }); onClose(); },
        onError: () => showToast({ type: 'error', title: 'Update failed' }),
      });
    } else {
      createCategory.mutate({ name: name.trim(), description: description.trim() || undefined }, {
        onSuccess: () => { showToast({ type: 'success', title: 'Category created' }); onClose(); },
        onError: () => showToast({ type: 'error', title: 'Creation failed' }),
      });
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.12)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>
            {isEditing ? 'Edit category' : 'New category'}
          </h3>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border2)', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink2)', marginBottom: 6 }}>
              Category name <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Main Course, Beverages"
              required
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(184,92,44,.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink2)', marginBottom: 6 }}>
              Description <span style={{ fontWeight: 300, color: 'var(--ink5)' }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="A short description visible on your menu"
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(184,92,44,.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Visibility */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)' }}>Visible on menu</span>
            <div onClick={() => setIsActive(!isActive)} style={{ width: 40, height: 22, borderRadius: 11, cursor: 'pointer', background: isActive ? '#2D7A4A' : 'var(--border2)', position: 'relative', transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 3, left: isActive ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={isPending || !name.trim()} style={{
              flex: 1, height: 40, background: 'var(--ink)', color: '#fff',
              border: 'none', borderRadius: 8, fontFamily: "'Geist', sans-serif",
              fontWeight: 500, fontSize: 14, cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: !name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {isPending && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .6s linear infinite' }} />}
              {isPending ? 'Saving…' : (isEditing ? 'Save changes' : 'Create category')}
            </button>
            <button type="button" onClick={onClose} style={{ padding: '0 16px', border: '1.5px solid var(--border2)', borderRadius: 8, background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 14, color: 'var(--ink3)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
