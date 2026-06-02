'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface SingleQRData {
  id: string;
  slug: string;
  scans: number;
  url: string;
  qr_image: string; // full data URL
}

export function SingleQRPanel() {
  const [data, setData] = useState<SingleQRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<SingleQRData>('/qr/single');
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = () => {
    if (!data) return;
    const a = document.createElement('a');
    a.href = data.qr_image;
    a.download = `dineflow-qr-${data.slug}.png`;
    a.click();
  };

  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setShowConfirm(false);
    setRegenerating(true);
    try {
      const res = await api.post<SingleQRData>('/qr/single/regenerate');
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 20, color: 'var(--ink)' }}>
              Outside / Takeaway QR
            </h2>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
              background: '#FFF7ED', color: '#C2410C',
              fontFamily: "'Geist', sans-serif", letterSpacing: '.04em',
            }}>
              TAKEAWAY
            </span>
          </div>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)', marginTop: 2 }}>
            For customers <strong>outside</strong> the restaurant. They scan, browse your menu, and place a takeaway order — you&apos;ll see it as an <em>Outside Order</em> in Live Orders.
          </p>
        </div>
        {data && (
          <div style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 11,
            background: 'var(--paper2)', borderRadius: 6, padding: '4px 10px',
            color: 'var(--ink4)',
          }}>
            {data.scans} scan{data.scans !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '24px', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* QR Image */}
        <div style={{ flexShrink: 0 }}>
          {loading || regenerating ? (
            <div style={{
              width: 180, height: 180, borderRadius: 12,
              background: 'var(--paper2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'shimmer 1.5s infinite linear',
              backgroundSize: '600px 100%',
              backgroundImage: 'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
            }} />
          ) : data ? (
            <div style={{
              width: 180, height: 180, borderRadius: 12,
              border: '1px solid var(--border)',
              overflow: 'hidden', padding: 8, background: '#fff',
            }}>
              <img
                src={data.qr_image}
                alt="Single QR Code"
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
          ) : null}
        </div>

        {/* Info + Actions */}
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* How it works */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
              How to use
            </p>
            {[
              { n: '1', text: 'Download or print this QR code' },
              { n: '2', text: 'Display it at the entrance, window, or social media' },
              { n: '3', text: 'Customer scans → sees your menu → enters name + phone → orders' },
              { n: '4', text: 'Order appears in Live Orders as "Outside Order" (Takeaway)' },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 7, alignItems: 'flex-start' }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>{n}</span>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* URL */}
          {data && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--paper2)', borderRadius: 8,
              padding: '8px 12px', marginBottom: 14,
            }}>
              <span style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 12,
                color: 'var(--ink3)', flex: 1, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {data.url}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  background: copied ? 'var(--green-bg)' : 'var(--border)',
                  color: copied ? 'var(--green)' : 'var(--ink3)',
                  fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer',
                  flexShrink: 0, transition: 'all .15s',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleDownload}
              disabled={!data || loading}
              style={{
                padding: '9px 18px', borderRadius: 8,
                background: 'var(--accent)', color: '#fff',
                border: 'none', fontFamily: "'Geist', sans-serif",
                fontWeight: 500, fontSize: 13, cursor: data ? 'pointer' : 'not-allowed',
                opacity: !data ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ↓ Download PNG
            </button>

            <button
              onClick={() => window.open(data?.url, '_blank')}
              disabled={!data}
              style={{
                padding: '9px 16px', borderRadius: 8,
                background: 'var(--paper2)', color: 'var(--ink3)',
                border: '1.5px solid var(--border2)',
                fontFamily: "'Geist', sans-serif", fontSize: 13, cursor: 'pointer',
              }}
            >
              Preview ↗
            </button>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={regenerating}
              style={{
                padding: '9px 16px', borderRadius: 8,
                background: 'none', color: 'var(--red)',
                border: '1.5px solid rgba(220,38,38,.2)',
                fontFamily: "'Geist', sans-serif", fontSize: 13,
                cursor: 'pointer', marginLeft: 'auto',
              }}
            >
              {regenerating ? 'Regenerating…' : '↺ Regenerate'}
            </button>
          </div>

          {/* Regenerate warning */}
          {showConfirm && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 8,
              background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
            }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', marginBottom: 8, fontWeight: 500 }}>
                ⚠️ Regenerating creates a new URL — any already-printed QR codes will stop working.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleRegenerate}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: 'var(--red)', color: '#fff',
                    fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Yes, regenerate
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  style={{
                    padding: '6px 12px', borderRadius: 6,
                    border: '1px solid var(--border)', background: '#fff',
                    fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer', color: 'var(--ink4)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
