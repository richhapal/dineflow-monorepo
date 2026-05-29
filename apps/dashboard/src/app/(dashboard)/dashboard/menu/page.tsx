'use client';
import { useState, useEffect } from 'react';
import { CategorySidebar } from '@/components/menu/CategorySidebar';
import { ItemGrid } from '@/components/menu/ItemGrid';
import { ItemDrawer } from '@/components/menu/ItemDrawer';
import { MenuEmptyState } from '@/components/menu/MenuEmptyState';
import { useCategories } from '@/hooks/useMenu';
import type { MenuItem } from '@dineflow/types';

export default function MenuPage() {
  const { data: categories, isLoading } = useCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null | 'new'>(null);

  // Auto-select first category once loaded
  useEffect(() => {
    if (!selectedCategoryId && categories && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const showDrawer = editingItem !== null;
  const drawerItem = editingItem === 'new' ? null : editingItem;

  const closeDrawer = () => setEditingItem(null);

  return (
    <>
      {/* Main layout — always 2 columns, drawer is an overlay */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        minHeight: 'calc(100vh - 56px)',
      }}>
        {/* Category Sidebar */}
        <CategorySidebar
          selectedCategoryId={selectedCategoryId}
          onSelect={id => {
            setSelectedCategoryId(id);
            setEditingItem(null);
          }}
        />

        {/* Main Item Grid or Empty State */}
        {!selectedCategoryId ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!isLoading && categories && categories.length === 0 ? (
              <MenuEmptyState type="no-category" onAction={() => {}} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 20, color: 'var(--ink4)' }}>
                  Select a category
                </p>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink5)', marginTop: 6 }}>
                  Choose from the left to manage items
                </p>
              </div>
            )}
          </div>
        ) : (
          <ItemGrid
            categoryId={selectedCategoryId}
            onEditItem={item => setEditingItem(item)}
            onNewItem={() => setEditingItem('new')}
          />
        )}
      </div>

      {/* Drawer overlay — slides in from right, fixed so it never squeezes the grid */}
      {showDrawer && selectedCategoryId && (
        <>
          {/* Backdrop — click outside to close */}
          <div
            onClick={closeDrawer}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.15)',
              backdropFilter: 'blur(1px)',
              animation: 'fadeIn .15s ease',
            }}
          />
          {/* Drawer panel */}
          <div style={{
            position: 'fixed', right: 0, top: 56, bottom: 0, zIndex: 50,
            width: 500,
            animation: 'slideInRight .2s ease',
            boxShadow: '-4px 0 24px rgba(0,0,0,.1)',
          }}>
            <ItemDrawer
              item={drawerItem}
              categoryId={selectedCategoryId}
              onClose={closeDrawer}
            />
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>
    </>
  );
}
