'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TableStatus } from '@dineflow/types';
import { formatINR } from '@dineflow/utils';
import { RestaurantTable } from './useTablesQR';
import { STATUS_STYLES } from './StatusLegend';

interface TableCardProps {
  table: RestaurantTable;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TableStatus) => void;
  elapsedMin: number;
}

const STATUS_ACTIONS: Partial<Record<TableStatus, TableStatus[]>> = {
  [TableStatus.AVAILABLE]: [TableStatus.RESERVED, TableStatus.CLEANING],
  [TableStatus.OCCUPIED]: [TableStatus.BILL_REQUESTED, TableStatus.CLEANING],
  [TableStatus.BILL_REQUESTED]: [TableStatus.CLEANING],
  [TableStatus.RESERVED]: [TableStatus.AVAILABLE, TableStatus.CLEANING],
  [TableStatus.CLEANING]: [TableStatus.AVAILABLE],
};

const STATUS_LABEL: Record<TableStatus, string> = {
  [TableStatus.AVAILABLE]: 'Available',
  [TableStatus.OCCUPIED]: 'Occupied',
  [TableStatus.BILL_REQUESTED]: 'Bill requested',
  [TableStatus.RESERVED]: 'Reserved',
  [TableStatus.CLEANING]: 'Cleaning',
  [TableStatus.MAINTENANCE]: 'Maintenance',
};

export default function TableCard({
  table,
  selected,
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
  elapsedMin,
}: TableCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const style = STATUS_STYLES[table.status];
  const isOvertime = elapsedMin >= 90;

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
    setMenuOpen((v) => !v);
  }

  const nextStatuses = STATUS_ACTIONS[table.status] ?? [];

  return (
    <>
      {table.status === TableStatus.BILL_REQUESTED && (
        <style>{`
          @keyframes pulse-border-${table.id.slice(-6)} {
            0%, 100% { box-shadow: 0 0 0 0 rgba(220,100,0,.4); }
            50% { box-shadow: 0 0 0 4px rgba(220,100,0,.15); }
          }
        `}</style>
      )}
      <div
        onClick={onClick}
        style={{
          borderRadius: 10,
          padding: '12px 10px',
          cursor: 'pointer',
          background: style.bg,
          border: `1.5px solid ${isOvertime && table.status === TableStatus.OCCUPIED ? '#e05c00' : style.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          minHeight: 80,
          transition: 'transform .15s, box-shadow .15s',
          position: 'relative',
          outline: selected ? '2px solid var(--accent)' : 'none',
          outlineOffset: 2,
          animation:
            table.status === TableStatus.BILL_REQUESTED
              ? `pulse-border-${table.id.slice(-6)} 2s ease-in-out infinite`
              : 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
        }}
      >
        {/* Table name */}
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 13,
            fontWeight: 600,
            color: style.color,
            letterSpacing: '.02em',
          }}
        >
          {table.name}
        </span>

        {/* Status-specific content */}
        {table.status === TableStatus.AVAILABLE && (
          <span
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 10,
              color: style.color,
              opacity: 0.7,
            }}
          >
            {table.capacity} seats
          </span>
        )}

        {table.status === TableStatus.OCCUPIED && (
          <>
            {table.covers != null && (
              <span
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 11,
                  color: style.color,
                  opacity: 0.85,
                }}
              >
                👤 {table.covers} · {elapsedMin}m
              </span>
            )}
            {isOvertime && (
              <span
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 10,
                  color: '#e05c00',
                  fontWeight: 600,
                }}
              >
                ⚠ Overtime
              </span>
            )}
          </>
        )}

        {table.status === TableStatus.BILL_REQUESTED && (
          <>
            <span
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 10,
                color: style.color,
                opacity: 0.85,
                fontWeight: 600,
              }}
            >
              💳 Bill req.
            </span>
            {table.bill_total != null && (
              <span
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  color: style.color,
                  opacity: 0.8,
                }}
              >
                {formatINR(table.bill_total)}
              </span>
            )}
          </>
        )}

        {table.status === TableStatus.RESERVED && (
          <span
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 10,
              color: style.color,
              opacity: 0.7,
            }}
          >
            Reserved
          </span>
        )}

        {table.status === TableStatus.CLEANING && (
          <span
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 10,
              color: style.color,
              opacity: 0.7,
            }}
          >
            🧹 Cleaning
          </span>
        )}

        {/* Group session badge */}
        {table.current_session_id && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 100,
              fontFamily: "'Geist', sans-serif",
            }}
          >
            GRP
          </span>
        )}

        {/* QR badge */}
        {(table.qr_count ?? 0) > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 24,
              background: 'rgba(0,0,0,.08)',
              color: style.color,
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 100,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            QR
          </span>
        )}

        {/* ⋮ context menu button */}
        <div
          style={{ position: 'absolute', top: 4, right: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={btnRef}
            onClick={openMenu}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: style.color,
              fontSize: 14,
              lineHeight: 1,
              padding: '2px 3px',
              borderRadius: 4,
              opacity: 0.7,
            }}
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Dropdown portalled to body — escapes grid stacking context */}
      {menuOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,.12)',
            minWidth: 170,
            overflow: 'hidden',
          }}
        >
          <MenuBtn onClick={() => { setMenuOpen(false); onEdit(); }}>
            ✏️ Edit table
          </MenuBtn>

          {nextStatuses.map((s) => (
            <MenuBtn
              key={s}
              onClick={() => { setMenuOpen(false); onStatusChange(s); }}
            >
              Mark as {STATUS_LABEL[s]}
            </MenuBtn>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />

          <MenuBtn onClick={() => { setMenuOpen(false); onDelete(); }} danger>
            🗑 Delete table
          </MenuBtn>
        </div>,
        document.body,
      )}
    </>
  );
}

function MenuBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: "'Geist', sans-serif",
        color: danger ? 'var(--red)' : 'var(--ink)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background =
          'var(--paper2)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = 'none')
      }
    >
      {children}
    </button>
  );
}
