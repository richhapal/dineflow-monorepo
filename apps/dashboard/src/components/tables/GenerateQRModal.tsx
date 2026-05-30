'use client';
import React, { useState, useEffect } from 'react';
import { RestaurantTable, QRCode, useBulkCreateQR } from './useTablesQR';
import { useToast } from '@/components/ui/Toast';

interface GenerateQRModalProps {
  tables: RestaurantTable[];
  qrCodes: QRCode[];
  onClose: () => void;
}

type Step = 'select' | 'success';

export default function GenerateQRModal({
  tables,
  qrCodes,
  onClose,
}: GenerateQRModalProps) {
  const { showToast } = useToast();
  const bulkCreate = useBulkCreateQR();

  // Tables that already have QR codes
  const tablesWithQR = new Set(
    qrCodes.map((q) => q.table_id).filter(Boolean),
  );
  const tablesWithoutQR = tables.filter((t) => !tablesWithQR.has(t.id));

  // Determine scenario: first-time (all tables) or partial
  const isFirstTime = qrCodes.length === 0;

  // Pre-select: if first time, select all; else select only tables without QR
  const defaultSelected = isFirstTime
    ? tables.map((t) => t.id)
    : tablesWithoutQR.map((t) => t.id);

  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [step, setStep] = useState<Step>('select');
  const [createdQRs, setCreatedQRs] = useState<QRCode[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleTable(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    const allIds = tables.map((t) => t.id);
    setSelected((prev) =>
      prev.length === allIds.length ? [] : allIds,
    );
  }

  async function handleGenerate() {
    if (selected.length === 0) return;
    try {
      const result = await bulkCreate.mutateAsync({ tableIds: selected });
      setCreatedQRs(Array.isArray(result) ? result : []);
      setStep('success');
      showToast({
        type: 'success',
        title: `${selected.length} QR codes generated`,
      });
    } catch {
      showToast({ type: 'error', title: 'Failed to generate QR codes' });
    }
  }

  async function handleBulkDownload() {
    if (createdQRs.length === 0) return;
    setDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('dineflow_token')
          : null;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      await Promise.all(
        createdQRs.map(async (qr) => {
          try {
            const { default: axios } = await import('axios');
            const res = await axios.get(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/qr/${qr.id}/image`,
              { headers },
            );
            const { qr_image } = res.data as { qr_image: string };
            if (qr_image) {
              zip.file(`${qr.name.replace(/\s+/g, '-')}-qr.png`, qr_image, {
                base64: true,
              });
            }
          } catch {
            // skip failed individual QRs
          }
        }),
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'qr-codes.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast({ type: 'error', title: 'Failed to create ZIP' });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.35)',
          zIndex: 200,
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 201,
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,.16)',
          width: 480,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                fontSize: 20,
                color: 'var(--ink)',
                marginBottom: 2,
              }}
            >
              {step === 'success' ? 'QR codes generated!' : 'Generate QR codes'}
            </h2>
            {step === 'select' && (
              <p
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: 'var(--ink4)',
                }}
              >
                {isFirstTime
                  ? 'First time setup — all tables selected'
                  : `${tablesWithoutQR.length} table${tablesWithoutQR.length !== 1 ? 's' : ''} without QR pre-selected`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              color: 'var(--ink4)',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {step === 'select' && (
          <>
            {/* Select all toggle */}
            <div
              style={{
                padding: '10px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  color: 'var(--ink4)',
                }}
              >
                {selected.length} of {tables.length} selected
              </span>
              <button
                onClick={toggleAll}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: 'var(--accent)',
                }}
              >
                {selected.length === tables.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Table list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {tables.length === 0 ? (
                <div
                  style={{
                    padding: '32px 24px',
                    textAlign: 'center',
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 13,
                    color: 'var(--ink4)',
                  }}
                >
                  No tables found. Add tables first.
                </div>
              ) : (
                tables.map((table) => {
                  const hasQR = tablesWithQR.has(table.id);
                  const isSelected = selected.includes(table.id);
                  return (
                    <label
                      key={table.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 24px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--paper2)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTable(table.id)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            fontFamily: "'Geist', sans-serif",
                            fontWeight: 500,
                            fontSize: 13,
                            color: 'var(--ink)',
                          }}
                        >
                          {table.name}
                        </span>
                        {table.section && (
                          <span
                            style={{
                              fontFamily: "'Geist', sans-serif",
                              fontSize: 11,
                              color: 'var(--ink4)',
                              marginLeft: 8,
                            }}
                          >
                            {table.section}
                          </span>
                        )}
                      </div>
                      {hasQR && (
                        <span
                          style={{
                            fontFamily: "'Geist', sans-serif",
                            fontSize: 11,
                            color: 'var(--green)',
                            background: 'var(--green-bg)',
                            padding: '2px 8px',
                            borderRadius: 100,
                          }}
                        >
                          Has QR
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <button
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 14,
                  color: 'var(--ink3)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={selected.length === 0 || bulkCreate.isPending}
                style={{
                  padding: '9px 22px',
                  background: 'var(--ink)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontFamily: "'Geist', sans-serif",
                  fontWeight: 500,
                  fontSize: 14,
                  cursor:
                    selected.length === 0 || bulkCreate.isPending
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    selected.length === 0 || bulkCreate.isPending ? 0.6 : 1,
                }}
              >
                {bulkCreate.isPending
                  ? 'Generating…'
                  : `Generate ${selected.length} QR code${selected.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div
            style={{
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'var(--green-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              ✓
            </div>
            <h3
              style={{
                fontFamily: "'Geist', sans-serif",
                fontWeight: 600,
                fontSize: 18,
                color: 'var(--ink)',
              }}
            >
              {createdQRs.length} QR code{createdQRs.length !== 1 ? 's' : ''} created
            </h3>
            <p
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 13,
                color: 'var(--ink4)',
                maxWidth: 300,
              }}
            >
              Your QR codes are ready. Download them all as a ZIP or print
              individually from the QR codes table.
            </p>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleBulkDownload}
                disabled={downloading || createdQRs.length === 0}
                style={{
                  padding: '10px 20px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  fontFamily: "'Geist', sans-serif",
                  fontWeight: 500,
                  fontSize: 13,
                  color: 'var(--ink3)',
                  cursor: downloading ? 'wait' : 'pointer',
                  opacity: downloading ? 0.7 : 1,
                }}
              >
                {downloading ? 'Zipping…' : '↓ Download ZIP'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
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
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
