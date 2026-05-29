'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatINR, formatDate } from '@dineflow/utils';
import { useDashboardStore } from '@/lib/store';

interface Bill {
  id: string;
  invoice_number: string;
  invoice_date: string;
  table_id?: string;
  table_name?: string;
  customer_name?: string;
  covers: number;
  items: { name: string; quantity: number; unit_price: number; total_price: number }[];
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  total_amount: number;
  payment_method: string;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
}

interface GSTSummary {
  total_revenue: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  total_gst: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Skeleton({ h, w }: { h?: number; w?: string | number }) {
  return (
    <div style={{
      width: w || '100%', height: h || 16, borderRadius: 6,
      background: 'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
      backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear',
    }} />
  );
}

function BillStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    PAID: { bg: 'var(--green-bg)', color: 'var(--green)' },
    PENDING: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
    CANCELLED: { bg: 'var(--red-bg)', color: 'var(--red)' },
  };
  const s = map[status] || map.PENDING;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100, fontFamily: "'Geist', sans-serif" }}>
      {status}
    </span>
  );
}

function InvoicePreview({ bill, restaurant, onClose }: {
  bill: Bill;
  restaurant: { name?: string; address?: string; gstin?: string; upi_id?: string } | null;
  onClose: () => void;
}) {
  const sendWhatsApp = useMutation({
    mutationFn: () => api.post(`/billing/${bill.id}/send-whatsapp`, {}),
  });

  return (
    <div style={{
      background: '#fff', borderLeft: '1px solid var(--border)',
      padding: 24, overflowY: 'auto', height: 'calc(100vh - 56px)',
      position: 'sticky', top: 56, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>Invoice</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink4)',
        }}>×</button>
      </div>

      {/* Thermal preview */}
      <div style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: 13, lineHeight: 1.8,
        background: 'var(--paper)',
        borderRadius: 10, padding: 20,
        border: '1px solid var(--border)',
      }}>
        {/* Restaurant name */}
        <p style={{ textAlign: 'center', fontFamily: "'Instrument Serif', serif", fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
          {restaurant?.name || 'Restaurant'}
        </p>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink4)', marginBottom: 4 }}>
          {restaurant?.address || ''} {restaurant?.gstin ? `· GSTIN: ${restaurant.gstin}` : ''}
        </p>

        <p style={{ color: 'var(--border2)', margin: '6px 0' }}>{'━'.repeat(24)}</p>

        <p>Invoice: {bill.invoice_number}</p>
        <p>Date: {formatDate(bill.invoice_date)}</p>
        <p>Table: {bill.table_name || bill.table_id || '—'} · Covers: {bill.covers}</p>

        <p style={{ color: 'var(--border2)', margin: '6px 0' }}>{'━'.repeat(24)}</p>
        <p style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>ITEM</span><span>AMT</span>
        </p>
        <p style={{ color: 'var(--border2)', margin: '4px 0' }}>{'━'.repeat(24)}</p>

        {bill.items.map((item, i) => (
          <p key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.quantity}× {item.name}
            </span>
            <span style={{ flexShrink: 0 }}>{formatINR(item.total_price)}</span>
          </p>
        ))}

        <p style={{ color: 'var(--border2)', margin: '6px 0' }}>{'━'.repeat(24)}</p>

        <p style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span><span>{formatINR(bill.subtotal)}</span>
        </p>
        <p style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>CGST @2.5%</span><span>{formatINR(bill.cgst_amount)}</span>
        </p>
        <p style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>SGST @2.5%</span><span>{formatINR(bill.sgst_amount)}</span>
        </p>

        <p style={{ color: 'var(--border2)', margin: '6px 0' }}>{'━'.repeat(24)}</p>

        <p style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>TOTAL</span><span>{formatINR(bill.total_amount)}</span>
        </p>

        <p style={{ color: 'var(--border2)', margin: '6px 0' }}>{'━'.repeat(24)}</p>

        <p>UPI: {restaurant?.upi_id || '—'}</p>
        <p>HSN/SAC: 996331</p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={{
          flex: 1, padding: '8px 12px', border: '1.5px solid var(--border2)', borderRadius: 8,
          background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12,
          color: 'var(--ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>🖨 Reprint</button>
        <button
          onClick={() => sendWhatsApp.mutate()}
          disabled={sendWhatsApp.isPending}
          style={{
            flex: 1, padding: '8px 12px', border: '1.5px solid var(--border2)', borderRadius: 8,
            background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12,
            color: 'var(--ink3)', cursor: 'pointer',
          }}>
          {sendWhatsApp.isPending ? 'Sending…' : '💬 Resend WhatsApp'}
        </button>
        {bill.status !== 'PAID' && (
          <button style={{
            width: '100%', padding: '8px 12px', border: '1px solid var(--red-bg)', borderRadius: 8,
            background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12,
            color: 'var(--red)', cursor: 'pointer',
          }}>Cancel bill</button>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { restaurant } = useDashboardStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data: bills, isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ['bills', month, year],
    queryFn: () => api.get(`/billing?month=${month}&year=${year}`).then(r => r.data),
  });

  const { data: gstSummary, isLoading: gstLoading } = useQuery<GSTSummary>({
    queryKey: ['gst-summary', month, year],
    queryFn: () => api.get(`/billing/gst-summary?month=${month}&year=${year}`).then(r => r.data),
  });

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleExport = async () => {
    const res = await api.get(`/billing/export-gstr1?month=${month}&year=${year}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `GSTR1-${month}-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredBills = (bills || []).filter(b => {
    const matchSearch = !search || b.invoice_number.toLowerCase().includes(search.toLowerCase()) || b.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>
      <div style={{ padding: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 26, color: 'var(--ink)' }}>Billing</h1>
            {/* Month selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--paper3)', border: '1px solid var(--border)', borderRadius: 100, padding: '4px 10px' }}>
              <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink4)', padding: '0 4px' }}>←</button>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--ink)', padding: '0 4px', minWidth: 90, textAlign: 'center' }}>
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink4)', padding: '0 4px' }}>→</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleExport} style={{
              padding: '9px 18px', background: 'var(--green-bg)', color: 'var(--green)',
              border: '1px solid rgba(45,122,74,.2)', borderRadius: 8,
              fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, cursor: 'pointer',
            }}>Export GSTR-1 CSV</button>
            <button style={{
              padding: '9px 18px', border: '1.5px solid var(--border2)', borderRadius: 8,
              background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 14,
              color: 'var(--ink3)', cursor: 'pointer',
            }}>Send to CA</button>
          </div>
        </div>

        {/* GST Summary banner */}
        <div style={{
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
          borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--accent)' }}>
              {MONTH_NAMES[month - 1]} {year} GST Summary
            </span>
            <a href="#" style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>Send to CA →</a>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {gstLoading ? (
              <div style={{ flex: 1 }}><Skeleton h={40} /></div>
            ) : (
              [
                { label: 'Total revenue', value: formatINR(gstSummary?.total_revenue || 0) },
                { label: 'Taxable amount', value: formatINR(gstSummary?.taxable_amount || 0) },
                { label: 'CGST @2.5%', value: formatINR(gstSummary?.cgst || 0) },
                { label: 'SGST @2.5%', value: formatINR(gstSummary?.sgst || 0) },
                { label: 'Total GST', value: formatINR(gstSummary?.total_gst || 0) },
              ].map((stat, idx, arr) => (
                <div key={stat.label} style={{
                  flex: 1,
                  paddingLeft: idx > 0 ? 20 : 0,
                  paddingRight: idx < arr.length - 1 ? 20 : 0,
                  borderLeft: idx > 0 ? '1px solid var(--accent-border)' : 'none',
                }}>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 20, fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>{stat.value}</p>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)' }}>{stat.label}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bills table */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedBill ? '1fr 480px' : '1fr', gap: 0 }}>
          {/* Main table */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: selectedBill ? 'var(--radius-lg) 0 0 var(--radius-lg)' : 'var(--radius-lg)', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  width: 200, border: '1px solid var(--border)', borderRadius: 8,
                  padding: '7px 12px', fontFamily: "'Geist', sans-serif", fontSize: 13, outline: 'none',
                }}
              />
              <select
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{
                  border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px',
                  fontFamily: "'Geist', sans-serif", fontSize: 13, outline: 'none', background: '#fff',
                }}
              >
                <option>All</option>
                <option>PAID</option>
                <option>PENDING</option>
                <option>CANCELLED</option>
              </select>
              <div style={{ flex: 1 }} />
              <button style={{
                padding: '7px 14px', border: '1.5px solid var(--border2)', borderRadius: 8,
                background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12,
                color: 'var(--ink3)', cursor: 'pointer',
              }}>🖨 Print all</button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--paper2)' }}>
                    {['Invoice #', 'Date', 'Table', 'Customer', 'Items', 'Amount', 'GST', 'Status', 'Actions'].map(col => (
                      <th key={col} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 11,
                        color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em',
                        whiteSpace: 'nowrap',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {billsLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}><td colSpan={9} style={{ padding: '12px 16px' }}><Skeleton h={20} /></td></tr>
                    ))
                  ) : filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)' }}>
                        No bills found for this period
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map(bill => (
                      <tr key={bill.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            title={bill.invoice_number}
                            style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink4)' }}
                          >
                            …{bill.invoice_number.slice(-8)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>
                          {formatDate(bill.invoice_date)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {bill.table_name && (
                            <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100, fontFamily: "'Geist Mono', monospace" }}>
                              {bill.table_name}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)' }}>
                          {bill.customer_name || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)' }}>
                          {bill.items.length} items
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                          {formatINR(bill.total_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink4)', whiteSpace: 'nowrap' }}>
                          {formatINR(bill.cgst_amount + bill.sgst_amount)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <BillStatusBadge status={bill.status} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setSelectedBill(bill)}
                              style={{
                                padding: '3px 10px', border: '1.5px solid var(--border)', borderRadius: 6,
                                background: 'transparent', fontSize: 11, color: 'var(--ink3)', cursor: 'pointer',
                                fontFamily: "'Geist', sans-serif",
                              }}
                            >View</button>
                            <button
                              onClick={() => api.post(`/billing/${bill.id}/send-whatsapp`, {})}
                              style={{
                                padding: '3px 10px', border: '1.5px solid var(--border)', borderRadius: 6,
                                background: 'transparent', fontSize: 11, color: 'var(--ink3)', cursor: 'pointer',
                                fontFamily: "'Geist', sans-serif",
                              }}
                            >Resend</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice preview */}
          {selectedBill && (
            <InvoicePreview
              bill={selectedBill}
              restaurant={restaurant}
              onClose={() => setSelectedBill(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
