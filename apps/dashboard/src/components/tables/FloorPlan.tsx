'use client';
import React from 'react';
import { TableStatus } from '@dineflow/types';
import { RestaurantTable } from './useTablesQR';
import TableCard from './TableCard';

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
  // Derive sections from data
  const sections = Array.from(
    new Set(tables.map((t) => t.section ?? 'Main').filter(Boolean)),
  );

  const allSections = [ALL_SECTION, ...sections];

  const visibleTables =
    selectedSection === ALL_SECTION
      ? tables
      : tables.filter((t) => (t.section ?? 'Main') === selectedSection);

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>

      {/* Section filter pills */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
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

      {/* Grid */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 12,
          }}
        >
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} h={80} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 12,
          }}
        >
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
            />
          ))}

          {/* Add table placeholder */}
          <button
            onClick={onAddTable}
            style={{
              borderRadius: 10,
              padding: '12px 10px',
              minHeight: 80,
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
              (e.currentTarget as HTMLButtonElement).style.background =
                'var(--paper2)';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--accent)';
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--accent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--border2)';
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--ink4)';
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
            <span
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Add table
            </span>
          </button>
        </div>
      )}
    </>
  );
}
