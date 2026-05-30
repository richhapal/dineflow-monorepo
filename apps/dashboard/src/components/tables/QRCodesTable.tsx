'use client';
import React, { useState, useMemo } from 'react';
import { QRCode } from './useTablesQR';
import QRCodeRow from './QRCodeRow';

interface QRCodesTableProps {
  qrCodes: QRCode[];
  isLoading: boolean;
  onViewQR: (id: string) => void;
  onGenerateQR: () => void;
  onRegenerate: (id: string) => void;
}

type SortKey = 'name' | 'total_scans' | 'last_scanned_at' | 'created_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'disabled';

function Skeleton() {
  return (
    <tr>
      <td colSpan={6} style={{ padding: '12px 20px' }}>
        <div
          style={{
            height: 20,
            borderRadius: 6,
            background:
              'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
            backgroundSize: '600px 100%',
            animation: 'shimmer 1.5s infinite linear',
          }}
        />
      </td>
    </tr>
  );
}

export default function QRCodesTable({
  qrCodes,
  isLoading,
  onViewQR,
  onGenerateQR,
  onRegenerate,
}: QRCodesTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    let list = [...qrCodes];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (qr) =>
          qr.name.toLowerCase().includes(q) ||
          qr.url.toLowerCase().includes(q),
      );
    }

    if (statusFilter === 'active') list = list.filter((qr) => qr.is_active);
    if (statusFilter === 'disabled') list = list.filter((qr) => !qr.is_active);

    list.sort((a, b) => {
      let av: string | number = a[sortKey] ?? '';
      let bv: string | number = b[sortKey] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [qrCodes, search, statusFilter, sortKey, sortDir]);

  // Bulk print PDF — opens print dialog for all QRs
  function handleBulkPrint() {
    window.print();
  }

  const COLUMNS: { key: SortKey | null; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: null, label: 'URL' },
    { key: 'total_scans', label: 'Total scans' },
    { key: 'last_scanned_at', label: 'Last scanned' },
    { key: null, label: 'Status' },
    { key: null, label: 'Actions' },
  ];

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>

      {/* Toolbar */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink4)',
              fontSize: 14,
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search QR codes…"
            style={{
              width: '100%',
              paddingLeft: 30,
              paddingRight: 10,
              paddingTop: 7,
              paddingBottom: 7,
              border: '1.5px solid var(--border)',
              borderRadius: 8,
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              color: 'var(--ink)',
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'active', 'disabled'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '5px 12px',
                borderRadius: 100,
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                cursor: 'pointer',
                background:
                  statusFilter === f ? 'var(--ink)' : 'transparent',
                color: statusFilter === f ? '#fff' : 'var(--ink4)',
                border:
                  statusFilter === f
                    ? '1px solid var(--ink)'
                    : '1px solid var(--border)',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={handleBulkPrint}
          style={{
            padding: '7px 14px',
            border: '1.5px solid var(--border)',
            borderRadius: 8,
            background: 'transparent',
            fontFamily: "'Geist', sans-serif",
            fontSize: 12,
            color: 'var(--ink3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🖨 Bulk print PDF
        </button>

        <button
          onClick={onGenerateQR}
          style={{
            padding: '7px 14px',
            background: 'var(--ink)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontFamily: "'Geist', sans-serif",
            fontWeight: 500,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ✦ Generate QR codes
        </button>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--paper2)' }}>
            {COLUMNS.map(({ key, label }) => (
              <th
                key={label}
                onClick={key ? () => handleSort(key) : undefined}
                style={{
                  padding: '10px 20px',
                  textAlign: 'left',
                  fontFamily: "'Geist', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  color: 'var(--ink4)',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  cursor: key ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
                {key && sortKey === key && (
                  <span style={{ marginLeft: 4 }}>
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} />)
          ) : filtered.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 32 }}>📷</span>
                  <p
                    style={{
                      fontFamily: "'Geist', sans-serif",
                      fontWeight: 500,
                      fontSize: 14,
                      color: 'var(--ink)',
                    }}
                  >
                    {search || statusFilter !== 'all'
                      ? 'No QR codes match your filters'
                      : 'No QR codes yet'}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Geist', sans-serif",
                      fontSize: 13,
                      color: 'var(--ink4)',
                    }}
                  >
                    {search || statusFilter !== 'all'
                      ? 'Try adjusting your search or filter'
                      : 'Generate QR codes for your tables to get started'}
                  </p>
                  {!search && statusFilter === 'all' && (
                    <button
                      onClick={onGenerateQR}
                      style={{
                        marginTop: 4,
                        padding: '8px 20px',
                        background: 'var(--ink)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontFamily: "'Geist', sans-serif",
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      ✦ Generate QR codes
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            filtered.map((qr) => (
              <QRCodeRow
                key={qr.id}
                qr={qr}
                onViewQR={onViewQR}
                onRegenerate={onRegenerate}
              />
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
