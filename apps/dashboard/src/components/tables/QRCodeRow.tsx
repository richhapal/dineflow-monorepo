'use client';
import React, { useState, useRef, useEffect } from 'react';
import { timeAgo } from '@dineflow/utils';
import { QRCode, useDisableQR, useDeleteQR } from './useTablesQR';
import { useToast } from '@/components/ui/Toast';

interface QRCodeRowProps {
  qr: QRCode;
  onViewQR: (id: string) => void;
  onRegenerate: (id: string) => void;
}

function ScansBadge({ count }: { count: number }) {
  let bg = 'var(--paper3)';
  let color = 'var(--ink4)';
  if (count > 100) { bg = 'var(--green-bg)'; color = 'var(--green)'; }
  else if (count > 20) { bg = 'var(--amber-bg)'; color = 'var(--amber)'; }

  return (
    <span
      style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: 13,
        fontWeight: 600,
        color,
        background: bg,
        padding: '2px 8px',
        borderRadius: 100,
      }}
    >
      {count}
    </span>
  );
}

export default function QRCodeRow({ qr, onViewQR, onRegenerate }: QRCodeRowProps) {
  const { showToast } = useToast();
  const disableQR = useDisableQR();
  const deleteQR = useDeleteQR();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  function copyURL() {
    navigator.clipboard.writeText(qr.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // Download the QR image (get from API)
  async function handleDownload() {
    try {
      const { default: axios } = await import('axios');
      const token = typeof window !== 'undefined' ? localStorage.getItem('dineflow_token') : null;
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/qr/${qr.id}/image`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const { qr_image } = res.data as { qr_image: string; url: string };
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${qr_image}`;
      link.download = `${qr.name.replace(/\s+/g, '-')}-qr.png`;
      link.click();
    } catch {
      showToast({ type: 'error', title: 'Failed to download QR' });
    }
  }

  const urlDisplay = (() => {
    try {
      const u = new URL(qr.url);
      return u.hostname + u.pathname;
    } catch {
      return qr.url;
    }
  })();

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--paper2)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')
      }
    >
      {/* Name + section */}
      <td style={{ padding: '13px 20px' }}>
        <p
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 500,
            fontSize: 13,
            color: 'var(--ink)',
            marginBottom: 1,
          }}
        >
          {qr.name}
        </p>
        {qr.table_id && (
          <p
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 11,
              color: 'var(--ink4)',
            }}
          >
            Table linked
          </p>
        )}
      </td>

      {/* URL */}
      <td style={{ padding: '13px 20px', maxWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            title={qr.url}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              color: 'var(--ink4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 160,
              display: 'block',
            }}
          >
            {urlDisplay}
          </span>
          <button
            onClick={copyURL}
            title="Copy URL"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              fontSize: 12,
              color: copied ? 'var(--green)' : 'var(--ink4)',
              flexShrink: 0,
            }}
          >
            {copied ? '✓' : '⎘'}
          </button>
        </div>
      </td>

      {/* Scan count */}
      <td style={{ padding: '13px 20px' }}>
        <ScansBadge count={qr.total_scans} />
      </td>

      {/* Last scanned */}
      <td
        style={{
          padding: '13px 20px',
          fontFamily: "'Geist', sans-serif",
          fontSize: 12,
          color: 'var(--ink4)',
        }}
      >
        {qr.last_scanned_at ? timeAgo(qr.last_scanned_at) : 'Never'}
      </td>

      {/* Status badge */}
      <td style={{ padding: '13px 20px' }}>
        <span
          style={{
            background: qr.is_active ? 'var(--green-bg)' : 'var(--paper3)',
            color: qr.is_active ? 'var(--green)' : 'var(--ink4)',
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 100,
            fontFamily: "'Geist', sans-serif",
          }}
        >
          {qr.is_active ? 'Active' : 'Disabled'}
        </span>
      </td>

      {/* Actions */}
      <td style={{ padding: '13px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ActionBtn onClick={() => onViewQR(qr.id)}>View QR</ActionBtn>
          <ActionBtn onClick={handleDownload}>Download</ActionBtn>

          {/* ⋮ overflow menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                color: 'var(--ink4)',
                padding: '2px 4px',
                borderRadius: 4,
                lineHeight: 1,
              }}
            >
              ⋮
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 50,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,.1)',
                  minWidth: 160,
                  overflow: 'hidden',
                }}
              >
                <DropBtn
                  onClick={() => {
                    setMenuOpen(false);
                    onRegenerate(qr.id);
                  }}
                >
                  🔄 Regenerate
                </DropBtn>
                <DropBtn
                  onClick={() => {
                    setMenuOpen(false);
                    disableQR.mutate(
                      { id: qr.id, enable: !qr.is_active },
                      {
                        onSuccess: () =>
                          showToast({
                            type: 'success',
                            title: qr.is_active ? 'QR disabled' : 'QR enabled',
                          }),
                        onError: () =>
                          showToast({ type: 'error', title: 'Action failed' }),
                      },
                    );
                  }}
                >
                  {qr.is_active ? '🚫 Disable' : '✅ Enable'}
                </DropBtn>
                <div
                  style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }}
                />
                <DropBtn
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    if (confirm(`Delete QR for ${qr.name}?`)) {
                      deleteQR.mutate(qr.id, {
                        onSuccess: () =>
                          showToast({ type: 'success', title: 'QR deleted' }),
                        onError: () =>
                          showToast({ type: 'error', title: 'Failed to delete QR' }),
                      });
                    }
                  }}
                >
                  🗑 Delete
                </DropBtn>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        border: '1.5px solid var(--border)',
        borderRadius: 6,
        background: 'transparent',
        fontFamily: "'Geist', sans-serif",
        fontSize: 11,
        color: 'var(--ink3)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function DropBtn({
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
        ((e.currentTarget as HTMLButtonElement).style.background = 'var(--paper2)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = 'none')
      }
    >
      {children}
    </button>
  );
}
