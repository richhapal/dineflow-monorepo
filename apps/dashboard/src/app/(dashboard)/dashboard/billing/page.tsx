'use client';
import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatINR, formatDate } from '@dineflow/utils';
import { useDashboardStore } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  method: string;
  amount: number;
  status: string;
  paid_at: string | null;
  upi_txn_id?: string | null;
  notes?: string | null;
}

interface BillItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_cancelled: boolean;
  notes?: string | null;
  addons?: Array<{ addon_name: string; price: number }>;
}

interface SessionOrder {
  id: string;
  customer_name?: string | null;
  total_amount: number;
  subtotal: number;
  items: BillItem[];
}

interface SessionData {
  id: string;
  table: { id: string; name: string };
  orders: SessionOrder[];
}

interface Bill {
  id: string;
  order_id: string | null;
  invoice_number: string;
  invoice_date: string;
  financial_year: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_gstin?: string | null;
  subtotal: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  service_charge: number;
  discount_amount: number;
  round_off: number;
  total_amount: number;
  hsn_code: string;
  status: 'DRAFT' | 'GENERATED' | 'SENT' | 'PAID' | 'CANCELLED';
  whatsapp_sent: boolean;
  print_count: number;
  // Single-order bill
  order?: {
    order_number?: number | null;
    covers: number;
    order_type: string;
    table?: { id: string; name: string } | null;
    items?: BillItem[];
  } | null;
  // Combined / session bill (getBills includes this for table badge in list)
  tableSession?: { id: string; table?: { id: string; name: string } | null } | null;
  // Session bill detail (loaded individually via getBill)
  sessionData?: SessionData | null;
  payments: Payment[];
}

interface BillsResponse {
  bills: Bill[];
  total: number;
  page: number;
  pages: number;
}

interface GSTSummary {
  total_invoices: number;
  gross_revenue: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  total_gst: number;
}

interface UnbilledOrder {
  id: string;
  order_number?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  covers: number;
  total_amount: number;
  completed_at?: string | null;
  table?: { id: string; name: string } | null;
  items: Array<{ item_name: string; quantity: number; total_price: number; is_cancelled: boolean }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const METHOD_LABELS: Record<string, string> = {
  UPI: '📱 UPI',
  CASH: '💵 Cash',
  CARD: '💳 Card',
  ONLINE: '🌐 Online',
  COMPLIMENTARY: '🎁 Complimentary',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT:     { bg: '#F3F4F6', color: '#6B7280' },
  GENERATED: { bg: '#EFF6FF', color: '#1D4ED8' },
  SENT:      { bg: '#F0FDF4', color: '#15803D' },
  PAID:      { bg: '#F0FDF4', color: '#15803D' },
  CANCELLED: { bg: '#FEF2F2', color: '#DC2626' },
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const mono: React.CSSProperties = { fontFamily: "'Geist Mono', monospace" };
const sans: React.CSSProperties = { fontFamily: "'Geist', sans-serif" };
const serif: React.CSSProperties = { fontFamily: "'Instrument Serif', serif" };

// Format a GST % cleanly: 2.5 → "2.5", 9.0 → "9", 2.50 → "2.5"
function fmtPct(n: number): string {
  return parseFloat(n.toFixed(4)).toString();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string | number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: 'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
      backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear',
    }} />
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.GENERATED;
  return (
    <span style={{
      ...sans, background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
    }}>
      {status}
    </span>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({
  bill,
  onClose,
  onSuccess,
}: {
  bill: Bill;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const amountPaid = bill.payments
    .filter(p => p.status === 'PAID')
    .reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(bill.total_amount) - amountPaid);

  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [upiTxnId, setUpiTxnId] = useState('');
  const [gatewayRef, setGatewayRef] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/billing/${bill.id}/payment`, {
        method,
        amount: Number(amount),
        upi_txn_id: upiTxnId || undefined,
        gateway_ref: gatewayRef || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  const inputStyle: React.CSSProperties = {
    ...sans, width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border)', fontSize: 14, color: 'var(--ink)',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28, width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ ...serif, fontStyle: 'italic', fontSize: 20, color: 'var(--ink)' }}>Record Payment</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink4)' }}>×</button>
        </div>

        {/* Balance summary */}
        <div style={{
          background: 'var(--paper2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ ...sans, fontSize: 11, color: 'var(--ink4)', marginBottom: 2 }}>TOTAL BILL</p>
            <p style={{ ...mono, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{formatINR(Number(bill.total_amount))}</p>
          </div>
          {amountPaid > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ ...sans, fontSize: 11, color: 'var(--ink4)', marginBottom: 2 }}>ALREADY PAID</p>
              <p style={{ ...mono, fontSize: 18, fontWeight: 700, color: '#15803D' }}>{formatINR(amountPaid)}</p>
            </div>
          )}
          {remaining > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ ...sans, fontSize: 11, color: 'var(--ink4)', marginBottom: 2 }}>REMAINING</p>
              <p style={{ ...mono, fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{formatINR(remaining)}</p>
            </div>
          )}
        </div>

        {/* Payment method */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...sans, display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Payment Method
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['CASH', 'UPI', 'CARD', 'COMPLIMENTARY'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                style={{
                  ...sans, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', textAlign: 'left',
                  border: method === m ? '2px solid var(--ink)' : '1.5px solid var(--border)',
                  background: method === m ? 'var(--ink)' : '#fff',
                  color: method === m ? '#fff' : 'var(--ink3)',
                }}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...sans, display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Amount (₹)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={inputStyle}
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        {/* UPI reference */}
        {method === 'UPI' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...sans, display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              UPI Transaction ID
            </label>
            <input style={inputStyle} placeholder="e.g. 123456789012" value={upiTxnId} onChange={e => setUpiTxnId(e.target.value)} />
          </div>
        )}

        {/* Card / Online reference */}
        {(method === 'CARD' || method === 'ONLINE') && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...sans, display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Reference / Approval Code
            </label>
            <input style={inputStyle} placeholder="e.g. TXN987654" value={gatewayRef} onChange={e => setGatewayRef(e.target.value)} />
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...sans, display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Notes (optional)
          </label>
          <input style={inputStyle} placeholder="e.g. Split payment" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {mutation.isError && (
          <p style={{ ...sans, fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>
            Failed to record payment. Please try again.
          </p>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !amount || Number(amount) <= 0}
          style={{
            ...sans, width: '100%', padding: '11px', borderRadius: 10,
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            opacity: (mutation.isPending || !amount || Number(amount) <= 0) ? 0.6 : 1,
          }}
        >
          {mutation.isPending ? 'Recording…' : `Record ${formatINR(Number(amount) || 0)} via ${method}`}
        </button>
      </div>
    </div>
  );
}

// ─── Invoice Panel ─────────────────────────────────────────────────────────────

function InvoicePanel({
  billId,
  restaurant,
  onClose,
  onRefetch,
}: {
  billId: string;
  restaurant: { name?: string; address?: string; gstin?: string; upi_id?: string } | null;
  onClose: () => void;
  onRefetch: () => void;
}) {
  const [showPayModal, setShowPayModal] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const qc = useQueryClient();

  const { data: bill, isLoading } = useQuery<Bill>({
    queryKey: ['bill', billId],
    queryFn: () => api.get(`/billing/${billId}`).then(r => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/billing/${billId}/cancel`, {}),
    onSuccess: () => { onRefetch(); qc.invalidateQueries({ queryKey: ['bill', billId] }); setCancelConfirm(false); onClose(); },
  });

  const whatsappMutation = useMutation({
    mutationFn: () => api.post(`/billing/${billId}/send-whatsapp`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bill', billId] }),
  });

  const handlePrint = useCallback(() => {
    if (!bill) return;
    const win = window.open('', '_blank', 'width=420,height=720');
    if (!win) { alert('Pop-up blocked — please allow pop-ups and try again.'); return; }
    const rName = restaurant?.name || 'Restaurant';
    const subtotalVal = Number(bill.subtotal);
    const cgstPctPrint = fmtPct(subtotalVal > 0 ? (Number(bill.cgst_amount) / subtotalVal * 100) : Number(bill.cgst_rate) * 100);
    const sgstPctPrint = fmtPct(subtotalVal > 0 ? (Number(bill.sgst_amount) / subtotalVal * 100) : Number(bill.sgst_rate) * 100);
    const paidRows = bill.payments.map(p =>
      `<tr><td colspan="2" style="color:#555">${p.method}</td><td style="text-align:right;color:#15803d">✓ ₹${Number(p.amount).toFixed(2)}</td></tr>`
    ).join('');
    const printTableName = bill.sessionData?.table?.name ?? bill.order?.table?.name;
    const printCovers = bill.sessionData
      ? `${bill.sessionData.orders.length} guest${bill.sessionData.orders.length !== 1 ? 's' : ''}`
      : bill.order?.covers ? `Covers: ${bill.order.covers}` : '';

    // Build item rows: either per-person (session) or flat (single order)
    const itemsHtml = bill.sessionData
      ? bill.sessionData.orders.map((person, pi) => `
          <tr><td colspan="3" style="padding-top:${pi > 0 ? 8 : 0}px;padding-bottom:2px">
            <span style="font-size:11px;font-weight:700;background:#f3f4f6;padding:2px 6px;border-radius:3px">
              👤 ${person.customer_name || `Guest ${pi + 1}`}
            </span>
          </td></tr>
          ${person.items.map(item =>
            `<tr>
              <td style="padding:2px 0;word-break:break-word">${item.item_name}</td>
              <td style="padding:2px 0;text-align:right;white-space:nowrap;color:#666">${item.quantity}×₹${Number(item.unit_price).toFixed(0)}</td>
              <td style="padding:2px 0;text-align:right;white-space:nowrap;font-weight:600">₹${Number(item.total_price).toFixed(2)}</td>
            </tr>
            ${(item.addons ?? []).map(a => `<tr><td colspan="3" style="padding:0 0 0 12px;font-size:11px;color:#888">+ ${a.addon_name} ₹${Number(a.price).toFixed(2)}</td></tr>`).join('')}`
          ).join('')}
          <tr style="border-top:1px dashed #ccc">
            <td colspan="2" style="font-size:11px;color:#888;padding-top:2px">${person.customer_name || `Guest ${pi + 1}`}'s total</td>
            <td style="text-align:right;font-size:11px;font-weight:600;padding-top:2px">₹${Number(person.total_amount).toFixed(2)}</td>
          </tr>
        `).join('')
      : (bill.order?.items?.filter(i => !i.is_cancelled) ?? []).map(item =>
          `<tr>
            <td style="padding:2px 0;word-break:break-word">${item.item_name}</td>
            <td style="padding:2px 0;text-align:right;white-space:nowrap;color:#666">${item.quantity}×₹${Number(item.unit_price).toFixed(0)}</td>
            <td style="padding:2px 0;text-align:right;white-space:nowrap;font-weight:600">₹${Number(item.total_price).toFixed(2)}</td>
          </tr>
          ${(item.addons ?? []).map(a => `<tr><td colspan="3" style="padding:0 0 0 12px;font-size:11px;color:#888">+ ${a.addon_name} ₹${Number(a.price).toFixed(2)}</td></tr>`).join('')}`
        ).join('');

    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Invoice ${bill.invoice_number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:monospace;font-size:13px;line-height:1.8;background:#f5f5f5;display:flex;flex-direction:column;align-items:center;padding:0}
  #toolbar{background:#fff;border-bottom:1px solid #ddd;padding:10px 16px;display:flex;gap:8px;justify-content:center;width:100%;position:sticky;top:0;z-index:10}
  #toolbar button{padding:8px 20px;border-radius:6px;border:none;font-family:monospace;font-size:13px;font-weight:600;cursor:pointer}
  #print-btn{background:#111;color:#fff}
  #close-btn{background:#f0f0f0;color:#333}
  #receipt{background:#fff;width:340px;padding:24px;margin:20px 0 40px}
  table{width:100%;border-collapse:collapse}
  .c{text-align:center} .r{text-align:right} .b{font-weight:700}
  .div{border-top:1px dashed #bbb;margin:8px 0}
  .sm{font-size:11px;color:#666}
  @media print{
    #toolbar{display:none}
    body{background:#fff;padding:0}
    #receipt{margin:0;padding:12px;width:100%}
    @page{margin:8mm;size:80mm auto}
  }
</style>
</head><body>
<div id="toolbar">
  <button id="print-btn" onclick="window.print()">🖨 Print Bill</button>
  <button id="close-btn" onclick="window.close()">✕ Close</button>
</div>
<div id="receipt">
<p class="c b" style="font-size:16px">${rName}</p>
${restaurant?.address ? `<p class="c sm" style="margin-top:2px">${restaurant.address}</p>` : ''}
${restaurant?.gstin ? `<p class="c sm">GSTIN: ${restaurant.gstin}</p>` : ''}
<div class="div"></div>
<p>Invoice: <b>${bill.invoice_number}</b></p>
<p>Date: ${new Date(bill.invoice_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</p>
${printTableName ? `<p>Table: ${printTableName}${printCovers ? ` · ${printCovers}` : ''}</p>` : ''}
${bill.customer_name ? `<p>Customer: ${bill.customer_name}</p>` : ''}
${bill.customer_phone ? `<p>Phone: ${bill.customer_phone}</p>` : ''}
<div class="div"></div>
<table>
  <thead><tr>
    <th style="text-align:left;font-size:11px;color:#888;font-weight:600;padding-bottom:4px">ITEM</th>
    <th style="text-align:right;font-size:11px;color:#888;font-weight:600;padding-bottom:4px">QTY×PRICE</th>
    <th style="text-align:right;font-size:11px;color:#888;font-weight:600;padding-bottom:4px">AMT</th>
  </tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="div"></div>
<table>
  <tr><td>Subtotal</td><td></td><td class="r">₹${subtotalVal.toFixed(2)}</td></tr>
  ${Number(bill.cgst_amount) > 0 ? `
  <tr><td>CGST @${cgstPctPrint}%</td><td></td><td class="r">₹${Number(bill.cgst_amount).toFixed(2)}</td></tr>
  <tr><td>SGST @${sgstPctPrint}%</td><td></td><td class="r">₹${Number(bill.sgst_amount).toFixed(2)}</td></tr>` : ''}
  ${Number(bill.service_charge) > 0 ? `<tr><td>Service charge</td><td></td><td class="r">₹${Number(bill.service_charge).toFixed(2)}</td></tr>` : ''}
  ${Number(bill.discount_amount) > 0 ? `<tr><td>Discount</td><td></td><td class="r">-₹${Number(bill.discount_amount).toFixed(2)}</td></tr>` : ''}
  ${Number(bill.round_off) !== 0 ? `<tr><td>Round off</td><td></td><td class="r">₹${Number(bill.round_off).toFixed(2)}</td></tr>` : ''}
</table>
<div class="div"></div>
<table><tr><td class="b" style="font-size:15px">TOTAL</td><td></td><td class="r b" style="font-size:15px">₹${Number(bill.total_amount).toFixed(2)}</td></tr></table>
${bill.payments.length > 0 ? `<div class="div"></div><table>${paidRows}</table>` : ''}
<div class="div"></div>
${restaurant?.upi_id ? `<p>UPI: ${restaurant.upi_id}</p>` : ''}
<p>HSN/SAC: ${bill.hsn_code}</p>
<p class="c sm" style="margin-top:10px">Thank you for dining with us!</p>
</div>
<script>
  window.addEventListener('afterprint', function() { window.close(); });
<\/script>
</body></html>`);
    win.document.close();
  }, [bill, restaurant]);

  if (isLoading || !bill) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.18)' }} />
        <div style={{
          position: 'fixed', top: 56, right: 0, bottom: 0, width: 420, zIndex: 50,
          background: '#fff', borderLeft: '1px solid var(--border)',
          padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Skeleton h={20} w={120} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink4)' }}>×</button>
          </div>
          {[1,2,3,4,5].map(i => <Skeleton key={i} h={14} w={i === 3 ? '70%' : '100%'} />)}
        </div>
      </>
    );
  }

  // ─── Derived values ────────────────────────────────────────────────────────
  const isSessionBill = !!bill.sessionData;
  // Table name: session bills get it from sessionData, single-order bills from order.table
  const tableName = bill.sessionData?.table?.name ?? bill.order?.table?.name;
  // For single-order bills, use order.items. For session bills, use sessionData.orders
  const flatItems = bill.order?.items?.filter(i => !i.is_cancelled) ?? [];
  const sessionOrders = bill.sessionData?.orders ?? [];
  const amountPaid = bill.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(bill.total_amount) - amountPaid);
  const subtotalNum = Number(bill.subtotal);
  // Compute GST % from actual amounts (avoids Decimal(4,2) rounding 2.5% → 3% in DB)
  const cgstPct = fmtPct(subtotalNum > 0 ? (Number(bill.cgst_amount) / subtotalNum * 100) : Number(bill.cgst_rate) * 100);
  const sgstPct = fmtPct(subtotalNum > 0 ? (Number(bill.sgst_amount) / subtotalNum * 100) : Number(bill.sgst_rate) * 100);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 49,
          background: 'rgba(0,0,0,0.18)',
        }}
      />

      {/* On-screen panel — fixed right drawer */}
      <div style={{
        position: 'fixed', top: 56, right: 0, bottom: 0,
        width: 420, zIndex: 50,
        background: '#fff', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
      }}>
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...sans, fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Invoice</span>
            <StatusBadge status={bill.status} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink4)' }}>×</button>
        </div>

        {/* Thermal receipt — scrollable */}
        <div style={{ padding: '20px', flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{
            ...mono, fontSize: 13, lineHeight: 1.9,
            background: 'var(--paper)', borderRadius: 10, padding: 20,
            border: '1px solid var(--border)',
          }}>
            {/* Restaurant header */}
            <p style={{ ...serif, textAlign: 'center', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              {restaurant?.name || 'Restaurant'}
            </p>
            {restaurant?.address && (
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink4)', marginBottom: 2 }}>
                {restaurant.address}
              </p>
            )}
            {restaurant?.gstin && (
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink4)', marginBottom: 2 }}>
                GSTIN: {restaurant.gstin}
              </p>
            )}

            <p style={{ color: 'var(--border2)', margin: '8px 0' }}>{'━'.repeat(28)}</p>

            <p>Invoice: <strong>{bill.invoice_number}</strong></p>
            <p>Date: {formatDate(bill.invoice_date)}</p>
            <p>F.Y.: {bill.financial_year}</p>
            {tableName && (
              <p>Table: {tableName}{isSessionBill
                ? ` · ${sessionOrders.length} guest${sessionOrders.length !== 1 ? 's' : ''}`
                : bill.order?.covers ? ` · Covers: ${bill.order.covers}` : ''
              }</p>
            )}
            {bill.customer_name && <p>Customer: {bill.customer_name}</p>}
            {bill.customer_phone && <p>Phone: {bill.customer_phone}</p>}
            {bill.customer_gstin && <p>GSTIN: {bill.customer_gstin}</p>}

            <p style={{ color: 'var(--border2)', margin: '8px 0' }}>{'━'.repeat(28)}</p>

            {/* ── SESSION BILL: per-person sections ── */}
            {isSessionBill ? (
              sessionOrders.length === 0 ? (
                <p style={{ ...sans, fontSize: 12, color: 'var(--ink4)', fontStyle: 'italic' }}>No items</p>
              ) : sessionOrders.map((person, pi) => (
                <div key={person.id}>
                  {/* Person header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ ...sans, fontSize: 11, fontWeight: 700, color: 'var(--ink)', background: 'var(--paper2)', padding: '2px 8px', borderRadius: 4 }}>
                      👤 {person.customer_name || `Guest ${pi + 1}`}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink4)' }}>
                      {person.items.length} item{person.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Column header once per person */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 62px', fontSize: 10, color: 'var(--ink4)', gap: 4, marginBottom: 2 }}>
                    <span>ITEM</span><span style={{ textAlign: 'right' }}>QTY×PRICE</span><span style={{ textAlign: 'right' }}>AMT</span>
                  </div>
                  {person.items.map((item, i) => (
                    <div key={i} style={{ marginBottom: 3 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 62px', gap: 4, alignItems: 'start' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', lineHeight: 1.4 }}>
                          {item.item_name}
                        </span>
                        <span style={{ color: 'var(--ink4)', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {item.quantity}×₹{Number(item.unit_price).toFixed(0)}
                        </span>
                        <span style={{ fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ₹{Number(item.total_price).toFixed(2)}
                        </span>
                      </div>
                      {item.addons?.map((a, ai) => (
                        <p key={ai} style={{ fontSize: 10, color: 'var(--ink4)', paddingLeft: 8, margin: 0 }}>
                          + {a.addon_name} ₹{Number(a.price).toFixed(2)}
                        </p>
                      ))}
                    </div>
                  ))}
                  {/* Per-person subtotal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 4, marginTop: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink4)' }}>{person.customer_name || `Guest ${pi + 1}`}'s subtotal</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>₹{Number(person.total_amount).toFixed(2)}</span>
                  </div>
                  {pi < sessionOrders.length - 1 && (
                    <p style={{ color: 'var(--border2)', margin: '4px 0 8px' }}>{'╌'.repeat(28)}</p>
                  )}
                </div>
              ))
            ) : (
              /* ── SINGLE-ORDER BILL: flat item list ── */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 62px', fontSize: 11, color: 'var(--ink4)', gap: 4, marginBottom: 2 }}>
                  <span>ITEM</span>
                  <span style={{ textAlign: 'right' }}>QTY×PRICE</span>
                  <span style={{ textAlign: 'right' }}>AMT</span>
                </div>
                <p style={{ color: 'var(--border2)', margin: '4px 0' }}>{'━'.repeat(28)}</p>
                {flatItems.length === 0 ? (
                  <p style={{ ...sans, fontSize: 12, color: 'var(--ink4)', fontStyle: 'italic' }}>No items</p>
                ) : flatItems.map((item, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 62px', gap: 4, alignItems: 'start' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {item.item_name}
                      </span>
                      <span style={{ color: 'var(--ink4)', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {item.quantity}×₹{Number(item.unit_price).toFixed(0)}
                      </span>
                      <span style={{ fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        ₹{Number(item.total_price).toFixed(2)}
                      </span>
                    </div>
                    {item.addons?.map((a, ai) => (
                      <p key={ai} style={{ fontSize: 11, color: 'var(--ink4)', paddingLeft: 8, margin: 0 }}>
                        + {a.addon_name} ₹{Number(a.price).toFixed(2)}
                      </p>
                    ))}
                  </div>
                ))}
              </>
            )}

            <p style={{ color: 'var(--border2)', margin: '8px 0' }}>{'━'.repeat(28)}</p>

            {/* Amounts */}
            {[
              { label: 'Subtotal', value: Number(bill.subtotal).toFixed(2) },
              ...(Number(bill.cgst_amount) > 0 ? [
                { label: `CGST @${cgstPct}%`, value: Number(bill.cgst_amount).toFixed(2) },
                { label: `SGST @${sgstPct}%`, value: Number(bill.sgst_amount).toFixed(2) },
              ] : []),
              ...(Number(bill.service_charge) > 0 ? [{ label: 'Service charge', value: Number(bill.service_charge).toFixed(2) }] : []),
              ...(Number(bill.discount_amount) > 0 ? [{ label: 'Discount', value: `-${Number(bill.discount_amount).toFixed(2)}` }] : []),
              ...(Number(bill.round_off) !== 0 ? [{ label: 'Round off', value: Number(bill.round_off).toFixed(2) }] : []),
            ].map(({ label, value }) => (
              <p key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink4)' }}>{label}</span>
                <span>₹{value}</span>
              </p>
            ))}

            <p style={{ color: 'var(--border2)', margin: '8px 0' }}>{'━'.repeat(28)}</p>

            <p style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
              <span>TOTAL</span><span>₹{Number(bill.total_amount).toFixed(2)}</span>
            </p>

            {/* Payment status */}
            {bill.payments.length > 0 && (
              <>
                <p style={{ color: 'var(--border2)', margin: '8px 0' }}>{'━'.repeat(28)}</p>
                {bill.payments.map(p => (
                  <p key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--ink4)' }}>{METHOD_LABELS[p.method] || p.method}</span>
                    <span style={{ color: '#15803D', fontWeight: 600 }}>✓ ₹{Number(p.amount).toFixed(2)}</span>
                  </p>
                ))}
                {remaining > 0 && (
                  <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--red)' }}>
                    <span>Balance due</span>
                    <span>₹{remaining.toFixed(2)}</span>
                  </p>
                )}
              </>
            )}

            <p style={{ color: 'var(--border2)', margin: '8px 0' }}>{'━'.repeat(28)}</p>

            {restaurant?.upi_id && <p>UPI: {restaurant.upi_id}</p>}
            <p>HSN/SAC: {bill.hsn_code}</p>
            <p style={{ textAlign: 'center', color: 'var(--ink4)', fontSize: 12, marginTop: 6 }}>Thank you for dining with us!</p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
        }}>
          {/* Primary: Record payment (if not fully paid / not cancelled) */}
          {bill.status !== 'PAID' && bill.status !== 'CANCELLED' && (
            <button
              onClick={() => setShowPayModal(true)}
              style={{
                ...sans, width: '100%', padding: '10px', borderRadius: 8,
                background: 'var(--accent)', color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {remaining > 0 ? `💰 Record Payment · ${formatINR(remaining)} due` : '💰 Record Payment'}
            </button>
          )}

          {bill.status === 'PAID' && (
            <div style={{
              ...sans, textAlign: 'center', padding: '10px', borderRadius: 8,
              background: '#F0FDF4', color: '#15803D', fontSize: 14, fontWeight: 600,
              border: '1px solid #BBF7D0',
            }}>
              ✓ Fully Paid · {formatINR(Number(bill.total_amount))}
            </div>
          )}

          {/* Secondary actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePrint}
              style={{
                ...sans, flex: 1, padding: '9px', border: '1.5px solid var(--border2)',
                borderRadius: 8, background: 'transparent', fontSize: 13,
                color: 'var(--ink3)', cursor: 'pointer',
              }}
            >
              🖨 Print
            </button>
            <button
              onClick={() => whatsappMutation.mutate()}
              disabled={whatsappMutation.isPending}
              style={{
                ...sans, flex: 1, padding: '9px', border: '1.5px solid var(--border2)',
                borderRadius: 8, background: 'transparent', fontSize: 13,
                color: 'var(--ink3)', cursor: 'pointer',
                opacity: whatsappMutation.isPending ? 0.6 : 1,
              }}
            >
              {whatsappMutation.isSuccess ? '✓ Sent' : bill.whatsapp_sent ? '💬 Resend WA' : '💬 Send WA'}
            </button>
          </div>

          {/* Cancel */}
          {bill.status !== 'PAID' && bill.status !== 'CANCELLED' && (
            cancelConfirm ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  style={{
                    ...sans, flex: 1, padding: '9px', borderRadius: 8,
                    background: 'var(--red, #dc2626)', color: '#fff', border: 'none',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel bill'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  style={{
                    ...sans, padding: '9px 16px', borderRadius: 8, border: '1.5px solid var(--border2)',
                    background: 'transparent', fontSize: 13, color: 'var(--ink4)', cursor: 'pointer',
                  }}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCancelConfirm(true)}
                style={{
                  ...sans, width: '100%', padding: '8px', border: '1px solid rgba(220,38,38,0.2)',
                  borderRadius: 8, background: '#FEF2F2', fontSize: 12,
                  color: 'var(--red, #dc2626)', cursor: 'pointer',
                }}
              >
                Cancel bill
              </button>
            )
          )}
        </div>
      </div>

      {showPayModal && (
        <RecordPaymentModal
          bill={bill}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['bill', billId] });
            onRefetch();
          }}
        />
      )}
    </>
  );
}

// ─── Unbilled Orders Tab ──────────────────────────────────────────────────────

function UnbilledOrdersTab({ onBillGenerated }: { onBillGenerated: () => void }) {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery<UnbilledOrder[]>({
    queryKey: ['unbilled-orders'],
    queryFn: () => api.get('/billing/unbilled-orders').then(r => r.data),
  });

  // Track which group/order is generating: key = tableId or orderId
  const [generating, setGenerating] = useState<string | null>(null);

  const generateSingle = async (orderId: string) => {
    setGenerating(orderId);
    try {
      await api.post(`/billing/generate/${orderId}`, {});
      qc.invalidateQueries({ queryKey: ['unbilled-orders'] });
      onBillGenerated();
    } finally {
      setGenerating(null);
    }
  };

  const generateCombined = async (orderIds: string[], key: string) => {
    setGenerating(key);
    try {
      await api.post('/billing/generate-combined', { order_ids: orderIds });
      qc.invalidateQueries({ queryKey: ['unbilled-orders'] });
      onBillGenerated();
    } finally {
      setGenerating(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton h={16} />
          </div>
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
        padding: '60px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
        <p style={{ ...sans, fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>All caught up!</p>
        <p style={{ ...sans, fontSize: 13, color: 'var(--ink4)' }}>All completed orders already have bills generated.</p>
      </div>
    );
  }

  // ── Group by table; orders with no table are individual ──
  const tableGroups: Map<string, { table: UnbilledOrder['table']; orders: UnbilledOrder[] }> = new Map();
  const noTableOrders: UnbilledOrder[] = [];

  for (const order of orders) {
    if (order.table) {
      const key = order.table.id;
      if (!tableGroups.has(key)) tableGroups.set(key, { table: order.table, orders: [] });
      tableGroups.get(key)!.orders.push(order);
    } else {
      noTableOrders.push(order);
    }
  }

  const renderOrderRow = (order: UnbilledOrder, indent = false) => {
    const items = order.items.filter(i => !i.is_cancelled);
    return (
      <div
        key={order.id}
        style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: `10px 20px 10px ${indent ? 36 : 20}px`,
          borderBottom: '1px solid var(--border)',
          background: indent ? 'var(--paper)' : '#fff',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
              #{String(order.order_number ?? 0).padStart(2, '0')}
            </span>
            <span style={{ ...sans, fontSize: 12, color: 'var(--ink3)' }}>
              {order.customer_name || 'Guest'}
            </span>
            <span style={{ ...sans, fontSize: 11, color: 'var(--ink4)' }}>
              · {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {items.slice(0, 3).map((it, i) => (
              <span key={i} style={{ ...sans, fontSize: 11, color: 'var(--ink4)' }}>
                {i > 0 ? '· ' : ''}{it.quantity}× {it.item_name}
              </span>
            ))}
            {items.length > 3 && (
              <span style={{ ...sans, fontSize: 11, color: 'var(--ink4)' }}>+ {items.length - 3} more</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ ...mono, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {formatINR(Number(order.total_amount))}
          </span>
          {/* Individual button only when NOT inside a table group */}
          {!indent && (
            <button
              onClick={() => generateSingle(order.id)}
              disabled={generating === order.id}
              style={{
                ...sans, padding: '7px 14px', borderRadius: 8,
                background: 'var(--accent)', color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                opacity: generating === order.id ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              {generating === order.id ? 'Generating…' : '+ Bill'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Table groups ── */}
      {Array.from(tableGroups.values()).map(({ table, orders: grpOrders }) => {
        const groupKey = `table-${table!.id}`;
        const totalAmt   = grpOrders.reduce((s: number, o: UnbilledOrder) => s + Number(o.total_amount), 0);
        const totalItems = grpOrders.reduce((s: number, o: UnbilledOrder) => s + o.items.filter((i: UnbilledOrder['items'][number]) => !i.is_cancelled).length, 0);
        const orderIds   = grpOrders.map((o: UnbilledOrder) => o.id);
        const isBusy = generating === groupKey;

        return (
          <div key={groupKey} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Group header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', background: 'var(--paper2)', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  ...sans, fontSize: 13, fontWeight: 700, color: 'var(--amber)',
                  background: 'var(--amber-bg)', padding: '2px 10px', borderRadius: 100,
                }}>
                  🪑 {table!.name}
                </span>
                <span style={{ ...sans, fontSize: 12, color: 'var(--ink4)' }}>
                  {grpOrders.length} order{grpOrders.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...mono, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {formatINR(totalAmt)}
                </span>
                <button
                  onClick={() => generateCombined(orderIds, groupKey)}
                  disabled={isBusy}
                  style={{
                    ...sans, padding: '8px 18px', borderRadius: 8,
                    background: isBusy ? 'var(--ink3)' : 'var(--ink)',
                    color: '#fff', border: 'none',
                    fontSize: 13, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap', opacity: isBusy ? 0.7 : 1,
                  }}
                >
                  {isBusy ? 'Generating…' : `🧾 Generate Combined Bill`}
                </button>
              </div>
            </div>
            {/* Individual orders inside group (indented, no button) */}
            {grpOrders.map((o: UnbilledOrder) => renderOrderRow(o, true))}
          </div>
        );
      })}

      {/* ── No-table orders (individual) ── */}
      {noTableOrders.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--paper2)' }}>
            <span style={{ ...sans, fontSize: 12, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Takeaway / No Table — {noTableOrders.length} order{noTableOrders.length !== 1 ? 's' : ''}
            </span>
          </div>
          {noTableOrders.map((o: UnbilledOrder) => renderOrderRow(o, false))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { restaurant } = useDashboardStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'bills' | 'unbilled'>('bills');

  // Auto-open a bill if redirected from the custom bill page (?bill=<id>)
  useEffect(() => {
    const billId = searchParams.get('bill');
    if (billId) {
      setSelectedBillId(billId);
      setActiveTab('bills');
      // Clean the URL param without full reload
      router.replace('/dashboard/billing');
    }
  }, [searchParams, router]);

  const { data: billsRes, isLoading: billsLoading } = useQuery<BillsResponse>({
    queryKey: ['bills', month, year],
    queryFn: () => api.get(`/billing?month=${month}&year=${year}`).then(r => r.data),
  });

  const { data: gstSummary, isLoading: gstLoading } = useQuery<GSTSummary>({
    queryKey: ['gst-summary', month, year],
    queryFn: () => api.get(`/billing/gst-summary?month=${month}&year=${year}`).then(r => r.data),
  });

  const { data: unbilledOrders } = useQuery<UnbilledOrder[]>({
    queryKey: ['unbilled-orders'],
    queryFn: () => api.get('/billing/unbilled-orders').then(r => r.data),
  });

  const refetchBills = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['bills', month, year] });
    qc.invalidateQueries({ queryKey: ['gst-summary', month, year] });
  }, [qc, month, year]);

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
    a.href = url;
    a.download = `GSTR1-${MONTH_NAMES[month - 1]}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bills = billsRes?.bills ?? [];
  const filteredBills = bills.filter(b => {
    const q = search.toLowerCase();
    const tableName = b.order?.table?.name ?? b.tableSession?.table?.name ?? '';
    const matchSearch = !search
      || b.invoice_number.toLowerCase().includes(q)
      || (b.customer_name ?? '').toLowerCase().includes(q)
      || tableName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const unbilledCount = unbilledOrders?.length ?? 0;

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
      `}</style>

      <div style={{ padding: '24px 28px', background: 'var(--paper, #fafaf9)', minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 style={{ ...serif, fontStyle: 'italic', fontSize: 26, color: 'var(--ink)' }}>Billing</h1>
            {/* Month navigator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--paper3)', border: '1px solid var(--border)',
              borderRadius: 100, padding: '4px 10px',
            }}>
              <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink4)', padding: '0 4px' }}>←</button>
              <span style={{ ...mono, fontSize: 13, color: 'var(--ink)', minWidth: 96, textAlign: 'center' }}>
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink4)', padding: '0 4px' }}>→</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => router.push('/dashboard/billing/custom')}
              style={{
                ...sans, padding: '9px 18px', background: 'var(--ink)', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              ＋ Custom Bill
            </button>
            <button
              onClick={handleExport}
              style={{
                ...sans, padding: '9px 18px', background: '#F0FDF4', color: '#15803D',
                border: '1px solid #BBF7D0', borderRadius: 8, fontWeight: 500, fontSize: 13, cursor: 'pointer',
              }}
            >
              ↓ Export GSTR-1 CSV
            </button>
          </div>
        </div>

        {/* ── GST Summary Banner ── */}
        <div style={{
          background: 'var(--accent-bg, #EFF6FF)', border: '1px solid var(--accent-border, #DBEAFE)',
          borderRadius: 12, padding: '18px 24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ ...sans, fontWeight: 600, fontSize: 13, color: 'var(--accent, #1D4ED8)' }}>
              {MONTH_NAMES[month - 1]} {year} — GST Summary
            </span>
            {!gstLoading && gstSummary && (
              <span style={{ ...sans, fontSize: 12, color: 'var(--ink4)' }}>
                {gstSummary.total_invoices} invoice{gstSummary.total_invoices !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {gstLoading ? (
              <div style={{ flex: 1 }}><Skeleton h={36} /></div>
            ) : !gstSummary ? null : (
              [
                { label: 'Gross Revenue',   value: formatINR(gstSummary.gross_revenue) },
                { label: 'Taxable Value',    value: formatINR(gstSummary.taxable_value) },
                { label: 'CGST Collected',   value: formatINR(gstSummary.cgst) },
                { label: 'SGST Collected',   value: formatINR(gstSummary.sgst) },
                { label: 'Total GST',        value: formatINR(gstSummary.total_gst) },
              ].map(({ label, value }, idx, arr) => (
                <div key={label} style={{
                  flex: 1,
                  paddingLeft: idx > 0 ? 20 : 0,
                  paddingRight: idx < arr.length - 1 ? 20 : 0,
                  borderLeft: idx > 0 ? '1px solid var(--accent-border, #DBEAFE)' : 'none',
                }}>
                  <p style={{ ...mono, fontSize: 19, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{value}</p>
                  <p style={{ ...sans, fontSize: 11, color: 'var(--ink4)' }}>{label}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 2,
          borderBottom: '1px solid var(--border)', marginBottom: 16,
        }}>
          {([
            { id: 'bills', label: '🧾 Bills', count: billsRes?.total },
            { id: 'unbilled', label: '⏳ Unbilled Orders', count: unbilledCount },
          ] as const).map(({ id, label, count }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                ...sans, padding: '8px 16px', border: 'none',
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--ink)' : 'var(--ink4)',
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1,
              }}>
                {label}
                {count != null && count > 0 && (
                  <span style={{
                    ...sans, fontSize: 11, fontWeight: 600,
                    background: active ? 'var(--ink)' : 'var(--paper3)',
                    color: active ? '#fff' : 'var(--ink4)',
                    padding: '1px 6px', borderRadius: 100,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Bills Tab ── */}
        {activeTab === 'bills' && (
          <div>
            {/* Table */}
            <div style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Toolbar */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  placeholder="Search invoice, customer, table…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    ...sans, flex: 1, maxWidth: 260, border: '1px solid var(--border)', borderRadius: 8,
                    padding: '7px 12px', fontSize: 13, outline: 'none', color: 'var(--ink)',
                  }}
                />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{
                    ...sans, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px',
                    fontSize: 13, outline: 'none', background: '#fff', color: 'var(--ink)',
                  }}
                >
                  <option>All</option>
                  <option>GENERATED</option>
                  <option>SENT</option>
                  <option>PAID</option>
                  <option>CANCELLED</option>
                </select>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--paper2)' }}>
                      {['Invoice #', 'Date', 'Order', 'Customer', 'Amount', 'GST', 'Payments', 'Status', ''].map(col => (
                        <th key={col} style={{
                          ...sans, padding: '10px 14px', textAlign: 'left',
                          fontWeight: 600, fontSize: 11, color: 'var(--ink4)',
                          textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap',
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billsLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}><td colSpan={9} style={{ padding: '12px 14px' }}><Skeleton h={18} /></td></tr>
                      ))
                    ) : filteredBills.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', ...sans, fontSize: 13, color: 'var(--ink4)' }}>
                          No bills found for {MONTH_NAMES[month - 1]} {year}
                        </td>
                      </tr>
                    ) : filteredBills.map(bill => {
                      const totalPaid = bill.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
                      const isSelected = selectedBillId === bill.id;
                      return (
                        <tr
                          key={bill.id}
                          onClick={() => setSelectedBillId(isSelected ? null : bill.id)}
                          style={{
                            borderBottom: '1px solid var(--border)', cursor: 'pointer',
                            background: isSelected ? 'var(--accent-bg, #EFF6FF)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--paper2)'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ ...mono, fontSize: 12, color: 'var(--ink3)' }} title={bill.invoice_number}>
                              {bill.invoice_number.split('-').pop()}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', ...sans, fontSize: 12, color: 'var(--ink4)', whiteSpace: 'nowrap' }}>
                            {formatDate(bill.invoice_date)}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {bill.order_id === null ? (
                                // Combined / session bill
                                <span style={{
                                  ...sans, fontSize: 11, background: '#EDE9FE', color: '#7C3AED',
                                  padding: '1px 7px', borderRadius: 100, fontWeight: 600,
                                }}>
                                  🧾 Group
                                </span>
                              ) : (
                                <span style={{ ...mono, fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>
                                  #{String(bill.order?.order_number ?? 0).padStart(2, '0')}
                                </span>
                              )}
                              {/* Table badge — works for both single-order and session bills */}
                              {(bill.order?.table?.name ?? bill.tableSession?.table?.name) && (
                                <span style={{
                                  ...sans, fontSize: 11, background: 'var(--amber-bg)', color: 'var(--amber)',
                                  padding: '1px 6px', borderRadius: 100, fontWeight: 500,
                                }}>
                                  {bill.order?.table?.name ?? bill.tableSession?.table?.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', ...sans, fontSize: 13, color: 'var(--ink)' }}>
                            {bill.customer_name || '—'}
                          </td>
                          <td style={{ padding: '11px 14px', ...mono, fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                            {formatINR(Number(bill.total_amount))}
                          </td>
                          <td style={{ padding: '11px 14px', ...mono, fontSize: 12, color: 'var(--ink4)', whiteSpace: 'nowrap' }}>
                            {formatINR(Number(bill.cgst_amount) + Number(bill.sgst_amount))}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {totalPaid > 0 ? (
                              <span style={{ ...mono, fontSize: 12, color: '#15803D' }}>
                                ✓ {formatINR(totalPaid)}
                              </span>
                            ) : (
                              <span style={{ ...sans, fontSize: 12, color: 'var(--ink5)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <StatusBadge status={bill.status} />
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ ...sans, fontSize: 12, color: 'var(--accent)' }}>
                              {isSelected ? 'Close ×' : 'View →'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination hint */}
              {billsRes && billsRes.total > bills.length && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', ...sans, fontSize: 12, color: 'var(--ink4)' }}>
                  Showing {bills.length} of {billsRes.total} bills
                </div>
              )}
            </div>

            {/* Invoice panel */}
            {selectedBillId && (
              <InvoicePanel
                billId={selectedBillId}
                restaurant={restaurant}
                onClose={() => setSelectedBillId(null)}
                onRefetch={refetchBills}
              />
            )}
          </div>
        )}

        {/* ── Unbilled Orders Tab ── */}
        {activeTab === 'unbilled' && (
          <UnbilledOrdersTab
            onBillGenerated={() => {
              refetchBills();
              setActiveTab('bills');
            }}
          />
        )}
      </div>
    </>
  );
}
