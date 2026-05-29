'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatINR, timeAgo } from '@dineflow/utils';
import { TableStatus } from '@dineflow/types';

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  current_order_id?: string;
  covers?: number;
  occupied_since?: string;
  bill_total?: number;
  section?: string;
}

interface QRCode {
  id: string;
  table_id?: string;
  name: string;
  url: string;
  total_scans: number;
  last_scanned_at?: string;
  is_active: boolean;
}

const TABLE_STATUS_STYLES: Record<TableStatus, { bg: string; border: string; color: string }> = {
  [TableStatus.AVAILABLE]:      { bg: 'var(--green-bg)',   border: 'rgba(45,122,74,.2)',    color: 'var(--green)' },
  [TableStatus.OCCUPIED]:       { bg: 'var(--amber-bg)',   border: 'rgba(133,79,11,.2)',    color: 'var(--amber)' },
  [TableStatus.BILL_REQUESTED]: { bg: 'var(--accent-bg)', border: 'var(--accent-border)',   color: 'var(--accent)' },
  [TableStatus.RESERVED]:       { bg: 'var(--blue-bg)',    border: 'rgba(24,95,165,.2)',     color: 'var(--blue)' },
  [TableStatus.CLEANING]:       { bg: 'var(--paper3)',     border: 'var(--border)',          color: 'var(--ink4)' },
};

const STATUS_LEGEND: { status: TableStatus; label: string }[] = [
  { status: TableStatus.AVAILABLE,      label: 'Available' },
  { status: TableStatus.OCCUPIED,       label: 'Occupied' },
  { status: TableStatus.BILL_REQUESTED, label: 'Bill requested' },
  { status: TableStatus.RESERVED,       label: 'Reserved' },
  { status: TableStatus.CLEANING,       label: 'Cleaning' },
];

function Skeleton({ h }: { h?: number }) {
  return (
    <div style={{
      width: '100%', height: h || 16, borderRadius: 6,
      background: 'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
      backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear',
    }} />
  );
}

function TableCard({ table, selected, onClick }: { table: Table; selected: boolean; onClick: () => void }) {
  const style = TABLE_STATUS_STYLES[table.status];
  const elapsedMin = table.occupied_since
    ? Math.floor((Date.now() - new Date(table.occupied_since).getTime()) / 60000) : 0;

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 10, padding: '12px 10px', cursor: 'pointer',
        background: style.bg, border: `1.5px solid ${style.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, minHeight: 70, transition: 'all .18s', position: 'relative',
        boxShadow: selected ? `0 0 0 2px var(--accent)` : 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 500, color: style.color }}>{table.name}</span>
      {table.status === 'OCCUPIED' && table.covers && (
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: style.color, opacity: .8 }}>
          👤{table.covers} · {elapsedMin}m
        </span>
      )}
      {table.status === 'BILL_REQUESTED' && table.bill_total && (
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: style.color, opacity: .8 }}>
          Bill {formatINR(table.bill_total)}
        </span>
      )}
      {table.status === 'AVAILABLE' && (
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: style.color, opacity: .7 }}>
          {table.capacity} seats
        </span>
      )}
      {(table.status === 'RESERVED') && (
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: style.color, opacity: .7 }}>Reserved</span>
      )}
      {(table.status === 'CLEANING') && (
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: style.color, opacity: .7 }}>Cleaning</span>
      )}
    </div>
  );
}

function TablePopover({ table, onClose }: { table: Table; onClose: () => void }) {
  const elapsedMin = table.occupied_since
    ? Math.floor((Date.now() - new Date(table.occupied_since).getTime()) / 60000) : 0;
  return (
    <div style={{
      position: 'absolute', zIndex: 10,
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 10, padding: 14,
      boxShadow: '0 4px 16px rgba(0,0,0,.1)',
      minWidth: 200,
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 8, right: 8,
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink4)',
      }}>×</button>
      <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>
        {table.name} · {table.status.replace('_', ' ')}
      </p>
      {table.status === 'OCCUPIED' && (
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)', marginBottom: 10 }}>
          {table.covers} guests · {elapsedMin} min
        </p>
      )}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      {table.current_order_id && (
        <>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink4)', marginBottom: 6 }}>
            Order #{table.current_order_id.slice(-6)}
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
          {table.bill_total && (
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
              Total: {formatINR(table.bill_total)}
            </p>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button style={{
          flex: 1, padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 6,
          background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer',
        }}>View order</button>
        <button style={{
          flex: 1, padding: '6px 10px', background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 6, fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer',
        }}>Request bill</button>
      </div>
    </div>
  );
}

export default function TablesPage() {
  const qc = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeSection, setActiveSection] = useState('Ground floor');

  const { data: tables, isLoading: tablesLoading } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: qrCodes, isLoading: qrLoading } = useQuery<QRCode[]>({
    queryKey: ['qr-codes'],
    queryFn: () => api.get('/qr').then(r => r.data),
  });

  const disableQR = useMutation({
    mutationFn: (id: string) => api.patch(`/qr/${id}/disable`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qr-codes'] }),
  });

  const sections = ['Ground floor', 'Rooftop', 'Bar'];

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>
      <div style={{ padding: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 26, color: 'var(--ink)' }}>Tables &amp; QR codes</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{
              padding: '9px 18px', border: '1.5px solid var(--border2)', borderRadius: 8,
              background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 14,
              color: 'var(--ink3)', cursor: 'pointer',
            }}>+ Add table</button>
            <button style={{
              padding: '9px 18px', background: 'var(--ink)', color: '#fff',
              border: 'none', borderRadius: 8, fontFamily: "'Geist', sans-serif", fontWeight: 500,
              fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>🖨 Generate all QR codes</button>
          </div>
        </div>

        {/* Floor plan card */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 20 }}>
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>Floor plan</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {sections.map(s => (
                <button key={s} onClick={() => setActiveSection(s)} style={{
                  padding: '4px 12px', borderRadius: 100,
                  background: activeSection === s ? 'var(--accent-bg)' : 'transparent',
                  color: activeSection === s ? 'var(--accent)' : 'var(--ink4)',
                  border: activeSection === s ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer',
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {tablesLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
              {[...Array(12)].map((_, i) => <Skeleton key={i} h={70} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, position: 'relative' }}>
              {(tables || []).filter(t => !t.section || t.section === activeSection).map(table => (
                <div key={table.id} style={{ position: 'relative' }}>
                  <TableCard
                    table={table}
                    selected={selectedTable?.id === table.id}
                    onClick={() => setSelectedTable(selectedTable?.id === table.id ? null : table)}
                  />
                  {selectedTable?.id === table.id && (
                    <TablePopover table={table} onClose={() => setSelectedTable(null)} />
                  )}
                </div>
              ))}

              {/* Placeholder tables when none loaded */}
              {(!tables || tables.length === 0) && [...Array(12)].map((_, i) => (
                <div key={i} style={{
                  borderRadius: 10, padding: '12px 10px', minHeight: 70,
                  background: 'var(--green-bg)', border: '1.5px solid rgba(45,122,74,.2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>T-{i + 1}</span>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 10, color: 'var(--green)', opacity: .7 }}>4 seats</span>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
            {STATUS_LEGEND.map(({ status, label }) => {
              const s = TABLE_STATUS_STYLES[status];
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)' }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* QR codes table */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>QR codes</span>
              <span style={{ background: 'var(--paper3)', color: 'var(--ink4)', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100 }}>
                {qrCodes?.length || 0}
              </span>
            </div>
            <button style={{
              padding: '6px 14px', border: '1.5px solid var(--border2)', borderRadius: 8,
              background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12,
              color: 'var(--ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>🖨 Bulk print PDF</button>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--paper2)' }}>
                {['Name', 'URL', 'Total scans', 'Last scanned', 'Status', 'Actions'].map(col => (
                  <th key={col} style={{
                    padding: '10px 20px', textAlign: 'left',
                    fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11,
                    color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {qrLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={6} style={{ padding: '12px 20px' }}><Skeleton h={20} /></td></tr>
                ))
              ) : qrCodes?.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)' }}>
                    No QR codes yet. Generate them to get started.
                  </td>
                </tr>
              ) : (
                (qrCodes || []).map((qr) => (
                  <tr key={qr.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '13px 20px', fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)' }}>{qr.name}</td>
                    <td style={{ padding: '13px 20px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink4)', maxWidth: 180 }}>
                      <span title={qr.url} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        yourbrand.app/m/{qr.url.split('/').pop()}
                      </span>
                    </td>
                    <td style={{ padding: '13px 20px', fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{qr.total_scans}</td>
                    <td style={{ padding: '13px 20px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)' }}>
                      {qr.last_scanned_at ? timeAgo(qr.last_scanned_at) : 'Never'}
                    </td>
                    <td style={{ padding: '13px 20px' }}>
                      <span style={{
                        background: qr.is_active ? 'var(--green-bg)' : 'var(--paper3)',
                        color: qr.is_active ? 'var(--green)' : 'var(--ink4)',
                        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100,
                        fontFamily: "'Geist', sans-serif",
                      }}>{qr.is_active ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td style={{ padding: '13px 20px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button style={{
                          padding: '3px 10px', border: '1.5px solid var(--border)', borderRadius: 6,
                          background: 'transparent', fontSize: 11, color: 'var(--ink3)', cursor: 'pointer',
                          fontFamily: "'Geist', sans-serif",
                        }}>Download</button>
                        <button style={{
                          padding: '3px 10px', border: '1.5px solid var(--border)', borderRadius: 6,
                          background: 'transparent', fontSize: 11, color: 'var(--ink3)', cursor: 'pointer',
                          fontFamily: "'Geist', sans-serif",
                        }}>Print</button>
                        <button
                          onClick={() => disableQR.mutate(qr.id)}
                          style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--red)', cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}
                        >Disable</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
