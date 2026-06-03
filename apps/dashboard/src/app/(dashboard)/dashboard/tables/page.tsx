'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { TableStatus } from '@dineflow/types';
import { WEBSOCKET_EVENTS } from '@dineflow/config';
import { useDashboardStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { useQueryClient } from '@tanstack/react-query';

import {
  useTables,
  useQRCodes,
  useUpdateTableStatus,
  tableKeys,
  RestaurantTable,
} from '@/components/tables/useTablesQR';

import FloorPlan from '@/components/tables/FloorPlan';
import StatusLegend from '@/components/tables/StatusLegend';
import TablePopover from '@/components/tables/TablePopover';
import AddTableModal from '@/components/tables/AddTableModal';
import DeleteTableConfirm from '@/components/tables/DeleteTableConfirm';
import QRCodesTable from '@/components/tables/QRCodesTable';
import QRImageModal from '@/components/tables/QRImageModal';
import GenerateQRModal from '@/components/tables/GenerateQRModal';
import { SingleQRPanel } from '@/components/ordering/SingleQRPanel';

const ALL_SECTION = '__ALL__';

type TableTab = 'floor' | 'qrcodes';

export default function TablesPage() {
  const [activeTab, setActiveTab] = useState<TableTab>('floor');
  const qc = useQueryClient();
  const { showToast } = useToast();
  const restaurant = useDashboardStore((s) => s.restaurant);

  // ─── Data ────────────────────────────────────────────────────────────────────
  const { data: rawTables = [], isLoading: tablesLoading } = useTables();
  const { data: qrCodes = [], isLoading: qrLoading } = useQRCodes();
  const updateStatus = useUpdateTableStatus();

  // Enrich tables with qr_count
  const tables: RestaurantTable[] = useMemo(() => {
    const qrCountMap: Record<string, number> = {};
    qrCodes.forEach((qr) => {
      if (qr.table_id) {
        qrCountMap[qr.table_id] = (qrCountMap[qr.table_id] ?? 0) + 1;
      }
    });
    return rawTables.map((t) => ({
      ...t,
      qr_count: qrCountMap[t.id] ?? 0,
    }));
  }, [rawTables, qrCodes]);

  // ─── Section state ────────────────────────────────────────────────────────────
  const [selectedSection, setSelectedSection] = useState<string>(ALL_SECTION);

  // Custom (user-created) sections — persisted in localStorage
  const LS_CUSTOM_SECTIONS = 'dineflow_custom_sections';
  const [customSections, setCustomSections] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(LS_CUSTOM_SECTIONS) || '[]'); }
    catch { return []; }
  });

  function handleCreateSection(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomSections((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      localStorage.setItem(LS_CUSTOM_SECTIONS, JSON.stringify(next));
      return next;
    });
  }

  function handleDeleteSection(name: string) {
    setCustomSections((prev) => {
      const next = prev.filter((s) => s !== name);
      localStorage.setItem(LS_CUSTOM_SECTIONS, JSON.stringify(next));
      return next;
    });
  }

  // Merge custom + DB-derived sections
  const dbSections = useMemo(
    () => Array.from(new Set(tables.map((t) => t.section ?? '').filter(Boolean))),
    [tables],
  );
  const managedSections = useMemo(
    () => Array.from(new Set([...customSections, ...dbSections])),
    [customSections, dbSections],
  );

  // ─── Elapsed time map (updates every 60s) ────────────────────────────────────
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const elapsedMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    tables.forEach((t) => {
      if (t.occupied_since) {
        map[t.id] = Math.floor(
          (Date.now() - new Date(t.occupied_since).getTime()) / 60_000,
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return map;
  // tick forces re-derive every minute
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, tick]);

  // ─── Popover state ────────────────────────────────────────────────────────────
  const [popoverTable, setPopoverTable] = useState<RestaurantTable | null>(null);
  const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function handleTableClick(table: RestaurantTable) {
    if (
      table.status === TableStatus.OCCUPIED ||
      table.status === TableStatus.BILL_REQUESTED
    ) {
      const el = cardRefs.current[table.id];
      if (el) {
        setPopoverAnchorRect(el.getBoundingClientRect());
        setPopoverTable(table);
      }
    }
  }

  // ─── Add/Edit table modal ─────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  // ─── Delete modal ─────────────────────────────────────────────────────────────
  const [deletingTable, setDeletingTable] = useState<RestaurantTable | null>(null);

  // ─── QR modals ────────────────────────────────────────────────────────────────
  const [qrViewId, setQrViewId] = useState<string | null>(null);
  const qrViewQR = useMemo(
    () => qrCodes.find((q) => q.id === qrViewId) ?? null,
    [qrCodes, qrViewId],
  );

  const [showGenerateQR, setShowGenerateQR] = useState(false);

  // ─── Status change ────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (table: RestaurantTable, status: TableStatus) => {
      updateStatus.mutate(
        { id: table.id, status },
        {
          onSuccess: () =>
            showToast({
              type: 'success',
              title: `${table.name} → ${status.replace('_', ' ').toLowerCase()}`,
            }),
          onError: () =>
            showToast({ type: 'error', title: 'Status update failed' }),
        },
      );
    },
    [updateStatus, showToast],
  );

  // ─── Clear all tables ─────────────────────────────────────────────────────────
  function handleClearAll() {
    if (
      !confirm(
        'Mark all available tables as Cleaning? This will not affect occupied or reserved tables.',
      )
    )
      return;
    const availableTables = tables.filter(
      (t) => t.status === TableStatus.AVAILABLE,
    );
    availableTables.forEach((t) =>
      updateStatus.mutate({ id: t.id, status: TableStatus.CLEANING }),
    );
    showToast({
      type: 'success',
      title: `${availableTables.length} tables marked for cleaning`,
    });
  }

  // ─── WebSocket ────────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!restaurant?.id) return;

    const base = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const socket = io(`${base}/ws`, {
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('dineflow_token') : null,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:restaurant', {
        restaurant_id: restaurant.id,
        role: 'dashboard',
      });
    });

    // Table status update — now also carries occupied_since
    socket.on(
      WEBSOCKET_EVENTS.TABLE_STATUS,
      (data: { table_id: string; status: TableStatus; occupied_since: string | null }) => {
        qc.setQueryData<RestaurantTable[]>(tableKeys.all, (old) =>
          (old ?? []).map((t) =>
            t.id === data.table_id
              ? { ...t, status: data.status, occupied_since: data.occupied_since ?? undefined }
              : t,
          ),
        );
      },
    );

    // New order — refresh tables (a new order may have changed occupied state)
    socket.on(WEBSOCKET_EVENTS.ORDER_NEW, () => {
      qc.invalidateQueries({ queryKey: tableKeys.all });
    });

    // Order status change — table status may have changed (confirm/cancel/serve)
    socket.on(WEBSOCKET_EVENTS.ORDER_STATUS, () => {
      qc.invalidateQueries({ queryKey: tableKeys.all });
    });

    socket.on('disconnect', () => {
      console.log('[WS] Tables page disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [restaurant?.id, qc]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 28,
              color: 'var(--ink)',
              marginBottom: 2,
            }}
          >
            Tables &amp; QR codes
          </h1>
          <p
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 13,
              color: 'var(--ink4)',
            }}
          >
            {tables.length} table{tables.length !== 1 ? 's' : ''} ·{' '}
            {qrCodes.filter((q) => q.is_active).length} active QR codes
          </p>
        </div>

        {/* Context-aware action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {activeTab === 'floor' && (
            <>
              <button
                onClick={handleClearAll}
                style={{
                  padding: '9px 16px',
                  border: '1.5px solid var(--border2)',
                  borderRadius: 8,
                  background: 'transparent',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: 'var(--ink3)',
                  cursor: 'pointer',
                }}
              >
                🧹 Clear all tables
              </button>
              <button
                onClick={() => {
                  setEditingTable(null);
                  setShowAddModal(true);
                }}
                style={{
                  padding: '9px 16px',
                  border: '1.5px solid var(--border2)',
                  borderRadius: 8,
                  background: 'transparent',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: 'var(--ink3)',
                  cursor: 'pointer',
                }}
              >
                + Add table
              </button>
            </>
          )}
          <button
            onClick={() => setShowGenerateQR(true)}
            style={{
              padding: '9px 18px',
              background: 'var(--ink)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontFamily: "'Geist', sans-serif",
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ✦ Generate QR codes
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex',
        gap: 2,
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        {([
          { id: 'floor' as TableTab, label: 'Table Layout', icon: '🪑' },
          { id: 'qrcodes' as TableTab, label: 'QR Codes', icon: '⬛', badge: qrCodes.length || undefined },
        ]).map(({ id, label, icon, badge }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: '9px 18px',
                border: 'none',
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--ink)' : 'var(--ink4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
              {badge !== undefined && (
                <span style={{
                  background: active ? 'var(--ink)' : 'var(--paper3)',
                  color: active ? '#fff' : 'var(--ink4)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: 100,
                  transition: 'background 0.15s, color 0.15s',
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Floor Plan tab ── */}
      {activeTab === 'floor' && (
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "'Geist', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--ink)',
              }}
            >
              Floor plan
            </span>
            {/* Table count by status */}
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                [TableStatus.AVAILABLE, 'var(--green)'],
                [TableStatus.OCCUPIED, 'var(--amber)'],
                [TableStatus.BILL_REQUESTED, '#c85a00'],
                [TableStatus.RESERVED, 'var(--blue)'],
                [TableStatus.CLEANING, 'var(--ink4)'],
              ] as [TableStatus, string][]).map(([status, color]) => {
                const count = tables.filter((t) => t.status === status).length;
                if (count === 0) return null;
                return (
                  <span
                    key={status}
                    style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color }}
                  >
                    {count}{' '}
                    {status === TableStatus.BILL_REQUESTED ? 'billing' : status.toLowerCase()}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <FloorPlan
              tables={tablesLoading ? [] : tables}
              selectedSection={selectedSection}
              onSectionChange={setSelectedSection}
              onTableClick={handleTableClick}
              onEditTable={(t) => { setEditingTable(t); setShowAddModal(true); }}
              onDeleteTable={setDeletingTable}
              onStatusChange={handleStatusChange}
              onAddTable={() => { setEditingTable(null); setShowAddModal(true); }}
              selectedTableId={popoverTable?.id ?? null}
              elapsedMap={elapsedMap}
              isLoading={tablesLoading}
              managedSections={managedSections}
              onCreateSection={handleCreateSection}
              onDeleteSection={handleDeleteSection}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <StatusLegend />
          </div>
        </div>
      )}

      {/* ── QR Codes tab ── */}
      {activeTab === 'qrcodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* QR codes table card */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                QR codes
              </span>
              <span style={{
                background: 'var(--paper3)',
                color: 'var(--ink4)',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 100,
                fontFamily: "'Geist', sans-serif",
              }}>
                {qrCodes.length}
              </span>
            </div>

            <QRCodesTable
              qrCodes={qrCodes}
              isLoading={qrLoading}
              onViewQR={(id) => setQrViewId(id)}
              onGenerateQR={() => setShowGenerateQR(true)}
              onRegenerate={(_id) => setShowGenerateQR(true)}
            />
          </div>

          {/* Single QR panel */}
          <SingleQRPanel />
        </div>
      )}

      {/* ─── Popovers & Modals ───────────────────────────────────────────────── */}

      {popoverTable && popoverAnchorRect && (
        <TablePopover
          table={popoverTable}
          anchorRect={popoverAnchorRect}
          onClose={() => {
            setPopoverTable(null);
            setPopoverAnchorRect(null);
          }}
          onStatusChanged={() => {
            qc.invalidateQueries({ queryKey: tableKeys.all });
          }}
        />
      )}

      {showAddModal && (
        <AddTableModal
          tables={tables}
          editTable={editingTable}
          managedSections={managedSections}
          onClose={() => {
            setShowAddModal(false);
            setEditingTable(null);
          }}
        />
      )}

      {deletingTable && (
        <DeleteTableConfirm
          table={deletingTable}
          onClose={() => setDeletingTable(null)}
          onDeleted={() => setDeletingTable(null)}
        />
      )}

      {qrViewQR && (
        <QRImageModal
          qr={qrViewQR}
          onClose={() => setQrViewId(null)}
        />
      )}

      {showGenerateQR && (
        <GenerateQRModal
          tables={tables}
          qrCodes={qrCodes}
          onClose={() => setShowGenerateQR(false)}
        />
      )}
    </div>
  );
}
