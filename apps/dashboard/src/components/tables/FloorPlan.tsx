'use client';
import React, { useState, useEffect, useRef } from 'react';
import { TableStatus } from '@dineflow/types';
import { RestaurantTable } from './useTablesQR';
import TableCard, { CardSize } from './TableCard';

interface FloorPlanProps {
  tables: RestaurantTable[];
  selectedSection: string;
  onSectionChange: (section: string) => void;
  onTableClick: (table: RestaurantTable) => void;
  onEditTable: (table: RestaurantTable) => void;
  onDeleteTable: (table: RestaurantTable) => void;
  onStatusChange: (table: RestaurantTable, status: TableStatus) => void;
  onAddTable: () => void;
  selectedTableId: string | null;
  elapsedMap: Record<string, number>;
  isLoading: boolean;
  // Section management
  managedSections: string[];
  onCreateSection: (name: string) => void;
  onDeleteSection: (name: string) => void;
  onRenameSection: (oldName: string, newName: string) => void;
}

const ALL_SECTION = '__ALL__';

// localStorage persistence keys
const LS_COLS = 'dineflow_fp_cols';
const LS_SIZE = 'dineflow_fp_size';

type GridCols = 3 | 4 | 6 | 8 | 'auto';
const AUTO_MIN_W: Record<CardSize, number> = { sm: 90, md: 120, lg: 160 };

function Skeleton({ h }: { h?: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: h ?? 80,
        borderRadius: 10,
        background:
          'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
        backgroundSize: '600px 100%',
        animation: 'shimmer 1.5s infinite linear',
      }}
    />
  );
}

function ToolPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 9px',
        borderRadius: 6,
        background: active ? 'var(--ink)' : 'transparent',
        color: active ? '#fff' : 'var(--ink4)',
        border: active ? '1px solid var(--ink)' : '1px solid var(--border2)',
        fontFamily: "'Geist', sans-serif",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        lineHeight: 1.4,
        transition: 'all .12s',
        minWidth: 28,
        textAlign: 'center',
      }}
    >
      {children}
    </button>
  );
}

export default function FloorPlan({
  tables,
  selectedSection,
  onSectionChange,
  onTableClick,
  onEditTable,
  onDeleteTable,
  onStatusChange,
  onAddTable,
  selectedTableId,
  elapsedMap,
  isLoading,
  managedSections,
  onCreateSection,
  onDeleteSection,
  onRenameSection,
}: FloorPlanProps) {
  // ── Grid settings (persisted) ────────────────────────────────────────────────
  const [gridCols, setGridCols] = useState<GridCols>(() => {
    if (typeof window === 'undefined') return 'auto';
    const v = localStorage.getItem(LS_COLS);
    if (v === 'auto') return 'auto';
    const n = Number(v);
    return ([3, 4, 6, 8] as GridCols[]).includes(n as GridCols) ? (n as GridCols) : 'auto';
  });

  const [cardSize, setCardSize] = useState<CardSize>(() => {
    if (typeof window === 'undefined') return 'md';
    const v = localStorage.getItem(LS_SIZE) as CardSize | null;
    return v && ['sm', 'md', 'lg'].includes(v) ? v : 'md';
  });

  useEffect(() => { localStorage.setItem(LS_COLS, String(gridCols)); }, [gridCols]);
  useEffect(() => { localStorage.setItem(LS_SIZE, cardSize); }, [cardSize]);

  // ── Section management state ──────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSection) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [addingSection]);

  // Derive table counts per section (to know if a section can be deleted)
  const sectionCount = tables.reduce<Record<string, number>>((acc, t) => {
    const s = t.section ?? '';
    if (s) acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  // Merge managed + DB-derived sections (deduplicated, preserving order)
  const tableSections = Array.from(new Set(tables.map((t) => t.section ?? '').filter(Boolean)));
  const displaySections = Array.from(new Set([...managedSections, ...tableSections]));

  const visibleTables =
    selectedSection === ALL_SECTION
      ? tables
      : tables.filter((t) => (t.section ?? '') === selectedSection);

  const gridTemplate =
    gridCols === 'auto'
      ? `repeat(auto-fill, minmax(${AUTO_MIN_W[cardSize]}px, 1fr))`
      : `repeat(${gridCols}, 1fr)`;

  function handleAddSection() {
    const name = newSectionName.trim();
    if (!name) { setAddingSection(false); return; }
    onCreateSection(name);
    setNewSectionName('');
    setAddingSection(false);
  }

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>

      {/* ── Controls row ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* LEFT: section pills + add/edit controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

          {/* All-sections pill */}
          <SectionPill
            label="All sections"
            active={selectedSection === ALL_SECTION}
            count={tables.length}
            editMode={false}
            canDelete={false}
            onClick={() => { onSectionChange(ALL_SECTION); }}
            onDelete={() => {}}
          />

          {/* Per-section pills */}
          {displaySections.map((s) => (
            <SectionPill
              key={s}
              label={s}
              active={selectedSection === s}
              count={sectionCount[s] ?? 0}
              editMode={editMode}
              canDelete={(sectionCount[s] ?? 0) === 0}
              onClick={() => { if (!editMode) onSectionChange(s); }}
              onDelete={() => {
                onDeleteSection(s);
                if (selectedSection === s) onSectionChange(ALL_SECTION);
              }}
              onRename={(newName) => {
                onRenameSection(s, newName);
                if (selectedSection === s) onSectionChange(newName);
              }}
            />
          ))}

          {/* Add section inline input */}
          {addingSection ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                ref={addInputRef}
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSection();
                  if (e.key === 'Escape') { setAddingSection(false); setNewSectionName(''); }
                }}
                placeholder="Section name…"
                style={{
                  padding: '3px 10px',
                  borderRadius: 100,
                  border: '1.5px solid var(--accent)',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: 'var(--ink)',
                  background: 'var(--accent-bg)',
                  outline: 'none',
                  width: 130,
                }}
              />
              <button
                onClick={handleAddSection}
                style={{
                  padding: '3px 10px',
                  borderRadius: 100,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setAddingSection(false); setNewSectionName(''); }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 100,
                  background: 'transparent',
                  color: 'var(--ink4)',
                  border: '1px solid var(--border)',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              title="Add new section"
              style={{
                padding: '4px 10px',
                borderRadius: 100,
                background: 'transparent',
                color: 'var(--accent)',
                border: '1.5px dashed var(--accent-border)',
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-bg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              + Section
            </button>
          )}

          {/* Edit/done toggle — only show when sections exist */}
          {displaySections.length > 0 && (
            <button
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? 'Done editing' : 'Manage sections'}
              style={{
                padding: '4px 10px',
                borderRadius: 100,
                background: editMode ? 'var(--amber-bg, #fff8e6)' : 'transparent',
                color: editMode ? 'var(--amber, #b45309)' : 'var(--ink4)',
                border: editMode
                  ? '1px solid var(--amber-border, #f0c060)'
                  : '1px solid var(--border)',
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {editMode ? '✓ Done' : '✏ Manage'}
            </button>
          )}
        </div>

        {/* RIGHT: size + columns controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)', marginRight: 2 }}>Size</span>
            {(['sm', 'md', 'lg'] as CardSize[]).map((s) => (
              <ToolPill key={s} active={cardSize === s} onClick={() => setCardSize(s)}>
                {s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L'}
              </ToolPill>
            ))}
          </div>
          <div style={{ width: 1, height: 18, background: 'var(--border2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)', marginRight: 2 }}>Cols</span>
            {([3, 4, 6, 8, 'auto'] as GridCols[]).map((c) => (
              <ToolPill key={c} active={gridCols === c} onClick={() => setGridCols(c)}>
                {c === 'auto' ? '⊞' : c}
              </ToolPill>
            ))}
          </div>
        </div>
      </div>

      {/* Edit mode hint banner */}
      {editMode && (
        <div style={{
          marginBottom: 12,
          padding: '8px 14px',
          borderRadius: 8,
          background: 'var(--amber-bg, #fff8e6)',
          border: '1px solid var(--amber-border, #f0c060)',
          fontFamily: "'Geist', sans-serif",
          fontSize: 12,
          color: 'var(--amber, #b45309)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>✏</span>
          <span>Click <strong>✏</strong> to rename a section (updates all tables). Click <strong>✕</strong> to delete an empty section.</span>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 12 }}>
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} h={cardSize === 'lg' ? 136 : cardSize === 'sm' ? 72 : 96} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 12 }}>
          {visibleTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              selected={selectedTableId === table.id}
              onClick={() => onTableClick(table)}
              onEdit={() => onEditTable(table)}
              onDelete={() => onDeleteTable(table)}
              onStatusChange={(status) => onStatusChange(table, status)}
              elapsedMin={elapsedMap[table.id] ?? 0}
              size={cardSize}
            />
          ))}
          <button
            onClick={onAddTable}
            style={{
              borderRadius: 10,
              padding: cardSize === 'lg' ? '20px 14px' : cardSize === 'sm' ? '8px 8px' : '12px 10px',
              minHeight: cardSize === 'lg' ? 136 : cardSize === 'sm' ? 72 : 96,
              background: 'transparent',
              border: '1.5px dashed var(--border2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              transition: 'all .15s',
              color: 'var(--ink4)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper2)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink4)';
            }}
          >
            <span style={{ fontSize: cardSize === 'lg' ? 24 : 18, lineHeight: 1 }}>+</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: cardSize === 'lg' ? 13 : cardSize === 'sm' ? 10 : 11, fontWeight: 500 }}>
              Add table
            </span>
          </button>
        </div>
      )}
    </>
  );
}

// ── Section pill (reusable) ────────────────────────────────────────────────────
function SectionPill({
  label,
  active,
  count,
  editMode,
  canDelete,
  onClick,
  onDelete,
  onRename,
}: {
  label: string;
  active: boolean;
  count: number;
  editMode: boolean;
  canDelete: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename?: (newName: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync label into renameVal if label changes externally
  useEffect(() => { setRenameVal(label); }, [label]);

  useEffect(() => {
    if (renaming) setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
  }, [renaming]);

  function commitRename() {
    const trimmed = renameVal.trim();
    if (trimmed && trimmed !== label) onRename?.(trimmed);
    setRenaming(false);
  }

  function cancelRename() {
    setRenameVal(label);
    setRenaming(false);
  }

  // In rename mode — show inline input
  if (renaming) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input
          ref={inputRef}
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') cancelRename();
          }}
          onBlur={commitRename}
          style={{
            padding: '3px 10px',
            borderRadius: 100,
            border: '1.5px solid var(--accent)',
            fontFamily: "'Geist', sans-serif",
            fontSize: 12,
            color: 'var(--ink)',
            background: 'var(--accent-bg)',
            outline: 'none',
            width: Math.max(100, label.length * 9),
          }}
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
          style={{
            padding: '3px 8px', borderRadius: 100, background: 'var(--accent)',
            color: '#fff', border: 'none', fontFamily: "'Geist', sans-serif",
            fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
        >✓</button>
        <button
          onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
          style={{
            padding: '3px 8px', borderRadius: 100, background: 'transparent',
            color: 'var(--ink4)', border: '1px solid var(--border)',
            fontFamily: "'Geist', sans-serif", fontSize: 11, cursor: 'pointer',
          }}
        >✕</button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        borderRadius: 100,
        background: active ? 'var(--accent-bg)' : 'transparent',
        border: active ? '1px solid var(--accent-border)' : '1px solid var(--border)',
        overflow: 'hidden',
        transition: 'all .15s',
      }}
    >
      <button
        onClick={onClick}
        style={{
          padding: '4px 12px',
          background: 'transparent',
          border: 'none',
          color: active ? 'var(--accent)' : 'var(--ink4)',
          fontFamily: "'Geist', sans-serif",
          fontSize: 12,
          cursor: editMode ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        {label}
        {count > 0 && (
          <span style={{
            background: active ? 'var(--accent)' : 'var(--paper3)',
            color: active ? '#fff' : 'var(--ink4)',
            borderRadius: 100,
            fontSize: 10,
            fontWeight: 600,
            padding: '0 5px',
            lineHeight: '16px',
            fontFamily: "'Geist', sans-serif",
          }}>
            {count}
          </span>
        )}
      </button>

      {/* Edit mode actions: rename + delete */}
      {editMode && (
        <>
          {/* Rename (pencil) */}
          <button
            onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
            title={`Rename "${label}"`}
            style={{
              padding: '4px 5px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink4)',
              fontSize: 11,
              lineHeight: 1,
            }}
          >
            ✏
          </button>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); if (canDelete) onDelete(); }}
            title={canDelete ? `Remove "${label}"` : `Move all tables out of "${label}" first`}
            style={{
              padding: '4px 8px 4px 2px',
              background: 'transparent',
              border: 'none',
              cursor: canDelete ? 'pointer' : 'not-allowed',
              color: canDelete ? 'var(--red, #dc2626)' : 'var(--ink4)',
              fontSize: 11,
              lineHeight: 1,
              opacity: canDelete ? 1 : 0.35,
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
