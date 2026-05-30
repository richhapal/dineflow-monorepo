'use client';
import React, { useEffect } from 'react';
import { useQRImage, QRCode } from './useTablesQR';
import { useDashboardStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

interface QRImageModalProps {
  qr: QRCode;
  onClose: () => void;
}

export default function QRImageModal({ qr, onClose }: QRImageModalProps) {
  const { showToast } = useToast();
  const restaurant = useDashboardStore((s) => s.restaurant);
  const { data, isLoading, isError } = useQRImage(qr.id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleDownload() {
    if (!data?.qr_image) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${data.qr_image}`;
    link.download = `${qr.name.replace(/\s+/g, '-')}-qr.png`;
    link.click();
  }

  function handlePrint() {
    window.print();
  }

  function handleCopyURL() {
    if (!data?.url && !qr.url) return;
    navigator.clipboard.writeText(data?.url ?? qr.url).then(() => {
      showToast({ type: 'success', title: 'URL copied to clipboard' });
    });
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .qr-print-card { display: flex !important; }
        }
        .qr-print-card { display: none; }
      `}</style>

      {/* Print-only card */}
      <div
        className="qr-print-card"
        style={{
          position: 'fixed',
          inset: 0,
          background: '#fff',
          zIndex: 9999,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 40,
        }}
      >
        {restaurant?.name && (
          <p
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 28,
              color: '#111',
            }}
          >
            {restaurant.name}
          </p>
        )}
        <p
          style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 16,
            color: '#333',
          }}
        >
          {qr.name}
        </p>
        {data?.qr_image && (
          <img
            src={`data:image/png;base64,${data.qr_image}`}
            alt={`QR for ${qr.name}`}
            style={{ width: 200, height: 200 }}
          />
        )}
        <p
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 12,
            color: '#666',
          }}
        >
          Scan to order
        </p>
      </div>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.4)',
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
          width: 400,
          maxWidth: '95vw',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: "'Geist', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--ink)',
            }}
          >
            {qr.name}
          </h2>
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

        {/* QR preview card */}
        <div style={{ padding: 24 }}>
          <div
            style={{
              background: 'var(--paper2)',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
            }}
          >
            {restaurant?.name && (
              <p
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: 'italic',
                  fontSize: 18,
                  color: 'var(--ink)',
                }}
              >
                {restaurant.name}
              </p>
            )}

            {isLoading && (
              <div
                style={{
                  width: 180,
                  height: 180,
                  background: 'var(--paper3)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 12,
                    color: 'var(--ink4)',
                  }}
                >
                  Loading…
                </span>
              </div>
            )}

            {isError && (
              <div
                style={{
                  width: 180,
                  height: 180,
                  background: '#fff2f2',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 12,
                    color: 'var(--red)',
                  }}
                >
                  Failed to load
                </span>
              </div>
            )}

            {data?.qr_image && (
              <img
                src={`data:image/png;base64,${data.qr_image}`}
                alt={`QR code for ${qr.name}`}
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 8,
                  display: 'block',
                }}
              />
            )}

            <p
              style={{
                fontFamily: "'Geist', sans-serif",
                fontWeight: 500,
                fontSize: 14,
                color: 'var(--ink)',
              }}
            >
              {qr.name}
            </p>

            <p
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                color: 'var(--ink4)',
                textAlign: 'center',
              }}
            >
              Scan to view menu &amp; order
            </p>
          </div>

          {/* URL display */}
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--paper3)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: 'var(--ink4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {data?.url ?? qr.url}
            </span>
            <button
              onClick={handleCopyURL}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--accent)',
                fontFamily: "'Geist', sans-serif",
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Copy URL
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDownload}
              disabled={!data?.qr_image}
              style={{
                flex: 1,
                padding: '9px 0',
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                background: 'transparent',
                fontFamily: "'Geist', sans-serif",
                fontWeight: 500,
                fontSize: 13,
                color: 'var(--ink3)',
                cursor: data?.qr_image ? 'pointer' : 'not-allowed',
                opacity: data?.qr_image ? 1 : 0.5,
              }}
            >
              ↓ Download PNG
            </button>
            <button
              onClick={handlePrint}
              disabled={!data?.qr_image}
              style={{
                flex: 1,
                padding: '9px 0',
                background: 'var(--ink)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: "'Geist', sans-serif",
                fontWeight: 500,
                fontSize: 13,
                cursor: data?.qr_image ? 'pointer' : 'not-allowed',
                opacity: data?.qr_image ? 1 : 0.5,
              }}
            >
              🖨 Print
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
