'use client';
import React from 'react';
import { TableStatus } from '@dineflow/types';

export const STATUS_STYLES: Record<
  TableStatus,
  { bg: string; border: string; color: string; label: string }
> = {
  [TableStatus.AVAILABLE]: {
    bg: 'var(--green-bg)',
    border: 'rgba(45,122,74,.2)',
    color: 'var(--green)',
    label: 'Available',
  },
  [TableStatus.OCCUPIED]: {
    bg: 'var(--amber-bg)',
    border: 'rgba(133,79,11,.2)',
    color: 'var(--amber)',
    label: 'Occupied',
  },
  [TableStatus.BILL_REQUESTED]: {
    bg: '#fff5ec',
    border: 'rgba(220,100,0,.25)',
    color: '#c85a00',
    label: 'Bill requested',
  },
  [TableStatus.RESERVED]: {
    bg: 'var(--blue-bg)',
    border: 'rgba(24,95,165,.2)',
    color: 'var(--blue)',
    label: 'Reserved',
  },
  [TableStatus.CLEANING]: {
    bg: 'var(--paper3)',
    border: 'var(--border)',
    color: 'var(--ink4)',
    label: 'Cleaning',
  },
  [TableStatus.MAINTENANCE]: {
    bg: '#f3f0ff',
    border: 'rgba(100,60,180,.2)',
    color: '#6b3fc2',
    label: 'Maintenance',
  },
};

const LEGEND_ORDER: TableStatus[] = [
  TableStatus.AVAILABLE,
  TableStatus.OCCUPIED,
  TableStatus.BILL_REQUESTED,
  TableStatus.RESERVED,
  TableStatus.CLEANING,
  TableStatus.MAINTENANCE,
];

export default function StatusLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {LEGEND_ORDER.map((status) => {
        const s = STATUS_STYLES[status];
        return (
          <div
            key={status}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: s.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                color: 'var(--ink4)',
              }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
