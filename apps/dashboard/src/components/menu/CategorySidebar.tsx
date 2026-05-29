'use client';
import { useState, useRef } from 'react';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCategories, useUpdateCategory, useDeleteCategory, useReorderCategories } from '@/hooks/useMenu';
import { CategoryForm } from './CategoryForm';
import { useToast } from '@/components/ui/Toast';
import type { MenuCategory } from '@dineflow/types';

interface Props {
  selectedCategoryId: string | null;
  onSelect: (id: string) => void;
}

function SkeletonRow() {
  return (
    <div style={{
      height: 38, margin: '2px 10px', borderRadius: 8,
      background: 'linear-gradient(90deg, var(--paper3) 25%, var(--paper2) 50%, var(--paper3) 75%)',
      backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite',
    }} />
  );
}

function MoreDropdown({ category, onEdit, onClose }: {
  category: MenuCategory;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      style={{ position: 'absolute', right: 8, top: '100%', zIndex: 50, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.1)', minWidth: 160, overflow: 'hidden' }}
      onClick={e => e.stopPropagation()}
    >
      {confirmDelete ? (
        <div style={{ padding: '12px 14px' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink)', marginBottom: 4 }}>Delete this category?</p>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)', marginBottom: 10 }}>All items inside will also be removed.</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border2)', borderRadius: 6, background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => {
              deleteCategory.mutate(category.id, {
                onSuccess: () => { showToast({ type: 'success', title: 'Category deleted' }); onClose(); },
                onError: () => showToast({ type: 'error', title: 'Delete failed' }),
              });
            }} style={{ flex: 1, padding: '5px 8px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 6, fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      ) : (
        <>
          <button onClick={() => { onEdit(); onClose(); }} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >Edit</button>
          <button onClick={() => {
            updateCategory.mutate({ id: category.id, is_active: !category.is_active }, {
              onSuccess: () => { showToast({ type: 'success', title: category.is_active ? 'Category hidden' : 'Category visible' }); onClose(); },
            });
          }} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >{category.is_active ? 'Hide' : 'Show'}</button>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
          <button onClick={() => setConfirmDelete(true)} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--red)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >Delete</button>
        </>
      )}
    </div>
  );
}

function SortableCategory({ category, isSelected, onSelect, onEdit }: {
  category: MenuCategory;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'all .15s',
    opacity: isDragging ? 0.5 : 1,
    padding: isSelected ? '8px 12px 8px 9px' : '8px 12px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    margin: '1px 8px',
    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
    marginLeft: isSelected ? '5px' : '8px',
    background: isSelected ? 'var(--accent-bg)' : 'transparent',
    color: isSelected ? 'var(--accent)' : 'var(--ink)',
    position: 'relative',
    userSelect: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => { setShowMore(false); onSelect(); }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--paper3)'; }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; setShowMore(false); }}
    >
      {/* Drag handle */}
      <span {...attributes} {...listeners} onClick={e => e.stopPropagation()}
        style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink5)', cursor: 'grab', flexShrink: 0, lineHeight: 1 }}>
        ⋮⋮
      </span>

      {/* Name */}
      <span style={{ flex: 1, fontFamily: "'Geist', sans-serif", fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {category.name}
      </span>

      {/* Count badge */}
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, background: 'var(--paper3)', borderRadius: 100, padding: '1px 6px', color: 'var(--ink4)', flexShrink: 0 }}>
        {(category.items?.length ?? 0)}
      </span>

      {/* Visibility dot */}
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: category.is_active ? '#4A9E6A' : 'var(--ink5)', flexShrink: 0 }} />

      {/* More button */}
      <div ref={moreRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setShowMore(p => !p); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink4)', padding: '0 2px', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center' }}
        >⋮</button>
        {showMore && (
          <MoreDropdown category={category} onEdit={onEdit} onClose={() => setShowMore(false)} />
        )}
      </div>
    </div>
  );
}

export function CategorySidebar({ selectedCategoryId, onSelect }: Props) {
  const { data: categories, isLoading } = useCategories();
  const reorderCategories = useReorderCategories();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const sorted = [...(categories || [])].sort((a, b) => a.sort_order - b.sort_order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sorted.findIndex(c => c.id === active.id);
    const newIdx = sorted.findIndex(c => c.id === over.id);
    const newOrder = arrayMove(sorted, oldIdx, newIdx);
    reorderCategories.mutate(newOrder.map(c => c.id));
  };

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>

      <div style={{ width: 260, background: 'var(--paper)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', position: 'sticky', top: 56, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Categories</span>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border2)', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--ink4)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
        </div>

        {/* List */}
        <div style={{ flex: 1 }}>
          {isLoading ? (
            [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sorted.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {sorted.map(cat => (
                  <SortableCategory
                    key={cat.id}
                    category={cat}
                    isSelected={cat.id === selectedCategoryId}
                    onSelect={() => onSelect(cat.id)}
                    onEdit={() => setEditingCategory(cat)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Add category bottom */}
        <div
          onClick={() => setShowCreateModal(true)}
          style={{ margin: 8, padding: 9, border: '1px dashed var(--border2)', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)', flexShrink: 0, transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink4)'; e.currentTarget.style.background = 'transparent'; }}
        >
          + Add category
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && <CategoryForm onClose={() => setShowCreateModal(false)} />}
      {editingCategory && <CategoryForm category={editingCategory} onClose={() => setEditingCategory(null)} />}
    </>
  );
}
