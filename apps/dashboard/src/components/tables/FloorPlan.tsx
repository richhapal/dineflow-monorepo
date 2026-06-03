'use client';
import React, { useState, useEffect } from 'react';
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
}

const ALL_SECTION = '__ALL__';

// localStorage persistence keys
const LS_COLS = 'dineflow_fp_cols';
const LS_SIZE = 'dineflow_fp_size';

type GridCols = 3 | 4 | 6 | 8 | 'auto';

// Card min-width per size used when gridCols === 'auto'
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

// ── Tiny pill button used for the toolbar ──────────────────────────────────────
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
      title={String(children)}
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

  // Persist to localStorage whenever changed
  useEffect(() => {
    localStorage.setItem(LS_COLS, String(gridCols));
  }, [gridCols]);
  useEffect(() => {
    localStorage.setItem(LS_SIZE, cardSize);
  }, [cardSize]);

  // ── Section filtering ────────────────────────────────────────────────────────
  const sections = Array.from(
    new Set(tables.map((t) => t.section ?? 'Main').filter(Boolean)),
  );
  const allSections = [ALL_SECTION, ...sections];

  const visibleTables =
    selectedSection === ALL_SECTION
      ? tables
      : tables.filter((t) => (t.section ?? 'Main') === selectedSection);

  // ── Grid CSS ─────────────────────────────────────────────────────────────────
  const gridTemplate =
    gridCols === 'auto'
      ? `repeat(auto-fill, minmax(${AUTO_MIN_W[cardSize]}px, 1fr))`
      : `repeat(${gridCols}, 1fr)`;

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>

      {/* ── Top bar: section pills (left) + view controls (right) ────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* Section filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {allSections.map((s) => {
            const active = selectedSection === s;
            const label = s === ALL_SECTION ? 'All sections' : s;
            return (
              <button
                key={s}
                onClick={() => onSectionChange(s)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 100,
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--ink4)',
                  border: active
                    ? '1px solid var(--accent-border)'
                    : '1px solid var(--border)',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* View controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Card size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 11,
              color: 'var(--ink4)',
              marginRight: 2,
            }}>
              Size
            </span>
            {(['sm', 'md', 'lg'] as CardSize[]).map((s) => (
              <ToolPill key={s} active={cardSize === s} onClick={() => setCardSize(s)}>
                {s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L'}
              </ToolPill>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: 'var(--border2)' }} />

          {/* Columns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 11,
              color: 'var(--ink4)',
              marginRight: 2,
            }}>
              Cols
            </span>
            {([3, 4, 6, 8, 'auto'] as GridCols[]).map((c) => (
              <ToolPill key={c} active={gridCols === c} onClick={() => setGridCols(c)}>
                {c === 'auto' ? '⊞' : c}
              </ToolPill>
            ))}
          </div>
        </div>
      </div>

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

          {/* Add table placeholder */}
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
            <span style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: cardSize === 'lg' ? 13 : cardSize === 'sm' ? 10 : 11,
              fontWeight: 500,
            }}>
              Add table
            </span>
          </button>
        </div>
      )}
    </>
  );
}
