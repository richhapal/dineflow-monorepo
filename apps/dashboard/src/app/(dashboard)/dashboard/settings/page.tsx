'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessHour {
  id?: string;
  day_of_week: number; // 0=Sun, 6=Sat
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start?: string | null;
  break_end?: string | null;
}

interface Holiday {
  id: string;
  date: string;
  reason: string;
  note?: string | null;
}

interface Discount {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  type: string;
  scope: string;
  applied_by: string;
  value: number;
  max_discount_cap?: number | null;
  min_order_amount?: number | null;
  menu_item_id?: string | null;
  category_id?: string | null;
  max_uses_total?: number | null;
  current_uses: number;
  valid_until?: string | null;
  is_active: boolean;
  menuItem?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
}

interface RestaurantSettings {
  id: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  timezone: string;
  gstin?: string;
  gst_rate: number;
  upi_id?: string;
  is_open: boolean;
  is_ordering_enabled: boolean;
  is_ordering_paused: boolean;
  auto_accept_orders?: boolean;
  order_timeout_minutes?: number;
  ordering_mode: string;
  whatsapp_bill?: boolean;
  sms_bill?: boolean;
  businessHours?: BusinessHour[];
  holidays?: Holiday[];
}

// ─── Day names ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 34,
        height: 18,
        borderRadius: 9,
        background: checked ? '#2D7A4A' : 'var(--border2, #d4d4d4)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );
}

// ─── Saved indicator ──────────────────────────────────────────────────────────

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span style={{
      fontSize: 13,
      color: '#2D7A4A',
      fontFamily: "'Geist', sans-serif",
      fontWeight: 500,
      animation: 'fadeIn 0.2s ease',
    }}>
      Saved ✓
    </span>
  );
}

// ─── Form field helpers ───────────────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--ink4)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
        fontFamily: "'Geist', sans-serif",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 14,
  color: 'var(--ink)',
  fontFamily: "'Geist', sans-serif",
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--ink4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: "'Geist', sans-serif",
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border)',
};

const saveButtonStyle: React.CSSProperties = {
  padding: '9px 22px',
  borderRadius: 8,
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "'Geist', sans-serif",
  cursor: 'pointer',
  border: 'none',
};

// ─── Section: Restaurant Info ─────────────────────────────────────────────────

function RestaurantInfoSection({ data, onRefetch }: { data: RestaurantSettings; onRefetch: () => void }) {
  const [form, setForm] = useState({
    name: data.name || '',
    description: data.description || '',
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    pincode: data.pincode || '',
    timezone: data.timezone || 'Asia/Kolkata',
    gstin: data.gstin || '',
  });
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: typeof form) => api.patch('/restaurants/me', payload),
    onSuccess: () => {
      onRefetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function set(key: keyof typeof form, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  return (
    <div>
      <p style={sectionLabelStyle}>Restaurant Info</p>

      <FieldRow label="Restaurant name">
        <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
      </FieldRow>

      <FieldRow label="Description">
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
      </FieldRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FieldRow label="Phone">
          <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
        </FieldRow>
        <FieldRow label="Email">
          <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </FieldRow>
      </div>

      <FieldRow label="Address">
        <input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} />
      </FieldRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }}>
        <FieldRow label="City">
          <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
        </FieldRow>
        <FieldRow label="State">
          <input style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)} />
        </FieldRow>
        <FieldRow label="Pincode">
          <input style={inputStyle} value={form.pincode} onChange={e => set('pincode', e.target.value)} />
        </FieldRow>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FieldRow label="Timezone">
          <select style={inputStyle} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
          </select>
        </FieldRow>
        <FieldRow label="GSTIN">
          <input style={inputStyle} value={form.gstin} onChange={e => set('gstin', e.target.value)} />
        </FieldRow>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          style={{ ...saveButtonStyle, opacity: mutation.isPending ? 0.6 : 1 }}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <SavedBadge show={saved} />
        {mutation.isError && (
          <span style={{ fontSize: 13, color: 'var(--red)', fontFamily: "'Geist', sans-serif" }}>
            Failed to save
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section: Business Hours ──────────────────────────────────────────────────

function BusinessHoursSection({ data, onRefetch }: { data: RestaurantSettings; onRefetch: () => void }) {
  const defaultHours = (): BusinessHour[] =>
    Array.from({ length: 7 }, (_, i) => {
      const existing = data.businessHours?.find(h => h.day_of_week === i);
      return existing
        ? { ...existing, break_start: existing.break_start ?? null, break_end: existing.break_end ?? null }
        : { day_of_week: i, is_open: i >= 1 && i <= 5, open_time: '09:00', close_time: '23:00', break_start: null, break_end: null };
    });

  const [hours, setHours] = useState<BusinessHour[]>(defaultHours);
  const [showBreak, setShowBreak] = useState<boolean[]>(
    Array.from({ length: 7 }, (_, i) => {
      const h = data.businessHours?.find(bh => bh.day_of_week === i);
      return !!(h?.break_start);
    })
  );
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: { hours: BusinessHour[] }) =>
      api.post('/restaurants/me/hours', payload),
    onSuccess: () => {
      onRefetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function updateHour(idx: number, patch: Partial<BusinessHour>) {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, ...patch } : h));
  }

  function applyWeekdayPreset() {
    setHours(prev =>
      prev.map((h, i) => ({
        ...h,
        is_open: i >= 1 && i <= 5,
        open_time: '09:00',
        close_time: '23:00',
      }))
    );
  }

  function handleSave() {
    const payload = hours.map(h => ({
      day_of_week: h.day_of_week,
      is_open: h.is_open,
      open_time: h.open_time,
      close_time: h.close_time,
      break_start: showBreak[h.day_of_week] ? (h.break_start || null) : null,
      break_end: showBreak[h.day_of_week] ? (h.break_end || null) : null,
    }));
    mutation.mutate({ hours: payload });
  }

  return (
    <div>
      <p style={sectionLabelStyle}>Business Hours</p>

      {/* Quick preset */}
      <div style={{
        background: 'var(--paper2, #f5f5f5)',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, color: 'var(--ink3)', fontFamily: "'Geist', sans-serif" }}>
          Quick set: Open all weekdays 9am–11pm
        </span>
        <button
          onClick={applyWeekdayPreset}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            background: '#fff',
            border: '1px solid var(--border)',
            fontSize: 13,
            color: 'var(--accent)',
            fontFamily: "'Geist', sans-serif",
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {hours.map((h, i) => (
          <div
            key={i}
            style={{
              padding: '12px 0',
              borderBottom: i < 6 ? '1px solid var(--border)' : 'none',
            }}
          >
            {/* Day row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 96 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: "'Geist', sans-serif" }}>
                  {DAY_NAMES[i]}
                </span>
              </div>
              <Toggle checked={h.is_open} onChange={val => updateHour(i, { is_open: val })} />
              {h.is_open && (
                <>
                  <input
                    type="time"
                    value={h.open_time}
                    onChange={e => updateHour(i, { open_time: e.target.value })}
                    style={{ ...inputStyle, width: 120 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>to</span>
                  <input
                    type="time"
                    value={h.close_time}
                    onChange={e => updateHour(i, { close_time: e.target.value })}
                    style={{ ...inputStyle, width: 120 }}
                  />
                </>
              )}
              {!h.is_open && (
                <span style={{ fontSize: 13, color: 'var(--ink5)', fontFamily: "'Geist', sans-serif", fontStyle: 'italic' }}>
                  Closed
                </span>
              )}
            </div>

            {/* Break time row */}
            {h.is_open && (
              <div style={{ paddingLeft: 110, marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showBreak[i]}
                    onChange={e => {
                      const next = [...showBreak];
                      next[i] = e.target.checked;
                      setShowBreak(next);
                    }}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>Break time</span>
                </label>
                {showBreak[i] && (
                  <>
                    <input
                      type="time"
                      value={h.break_start || ''}
                      placeholder="Break start"
                      onChange={e => updateHour(i, { break_start: e.target.value })}
                      style={{ ...inputStyle, width: 110 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>to</span>
                    <input
                      type="time"
                      value={h.break_end || ''}
                      placeholder="Break end"
                      onChange={e => updateHour(i, { break_end: e.target.value })}
                      style={{ ...inputStyle, width: 110 }}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20 }}>
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          style={{ ...saveButtonStyle, opacity: mutation.isPending ? 0.6 : 1 }}
        >
          {mutation.isPending ? 'Saving…' : 'Save hours'}
        </button>
        <SavedBadge show={saved} />
        {mutation.isError && (
          <span style={{ fontSize: 13, color: 'var(--red)', fontFamily: "'Geist', sans-serif" }}>
            Failed to save
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section: Ordering Settings ───────────────────────────────────────────────

function OrderingSection({ data, onRefetch }: { data: RestaurantSettings; onRefetch: () => void }) {
  const [form, setForm] = useState({
    is_ordering_enabled: data.is_ordering_enabled,
    auto_accept_orders: data.auto_accept_orders ?? false,
    order_timeout_minutes: data.order_timeout_minutes ?? 10,
    ordering_mode: data.ordering_mode || 'SELF',
    whatsapp_bill: data.whatsapp_bill ?? false,
    sms_bill: data.sms_bill ?? false,
  });
  const [saved, setSaved] = useState(false);

  const toggleOpenMutation = useMutation({
    mutationFn: () => api.post('/restaurants/me/toggle-open', {}),
    onSuccess: onRefetch,
  });

  const togglePauseMutation = useMutation({
    mutationFn: () => api.post('/restaurants/me/toggle-pause', {}),
    onSuccess: onRefetch,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof form) => api.patch('/restaurants/me', payload),
    onSuccess: () => {
      onRefetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  return (
    <div>
      <p style={sectionLabelStyle}>Ordering Settings</p>

      {/* Open/Close status card */}
      <div style={{
        border: `2px solid ${data.is_open ? '#2D7A4A' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        background: data.is_open ? '#f0faf4' : 'var(--paper2, #f5f5f5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <p style={{
            fontSize: 16,
            fontWeight: 600,
            color: data.is_open ? '#2D7A4A' : 'var(--ink4)',
            fontFamily: "'Geist', sans-serif",
            marginBottom: 4,
          }}>
            Restaurant is currently <strong>{data.is_open ? 'OPEN' : 'CLOSED'}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
            {data.is_open
              ? 'Customers can browse and order'
              : 'Customers can browse but cannot order'}
          </p>
        </div>
        <button
          onClick={() => toggleOpenMutation.mutate()}
          disabled={toggleOpenMutation.isPending}
          style={{
            flexShrink: 0,
            padding: '9px 18px',
            borderRadius: 8,
            background: data.is_open ? 'var(--red-bg, #fef2f2)' : '#2D7A4A',
            color: data.is_open ? 'var(--red, #dc2626)' : '#fff',
            border: data.is_open ? '1px solid rgba(220,38,38,0.2)' : 'none',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Geist', sans-serif",
            cursor: 'pointer',
            opacity: toggleOpenMutation.isPending ? 0.6 : 1,
          }}
        >
          {data.is_open ? 'Mark as Closed' : 'Mark as Open'}
        </button>
      </div>

      {/* Pause orders */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", marginBottom: 2 }}>
            Pause new orders
          </p>
          <p style={{ fontSize: 12, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
            {data.is_ordering_paused ? 'Orders are currently paused' : 'Accepting new orders'}
          </p>
        </div>
        <Toggle
          checked={data.is_ordering_paused}
          onChange={() => togglePauseMutation.mutate()}
          disabled={togglePauseMutation.isPending}
        />
      </div>

      {/* Form toggles */}
      {(
        [
          { key: 'is_ordering_enabled', label: 'Enable online ordering', desc: 'Allow customers to place orders via menu QR' },
          { key: 'auto_accept_orders', label: 'Auto-accept orders', desc: 'Automatically confirm incoming orders' },
          { key: 'whatsapp_bill', label: 'Send bill via WhatsApp', desc: 'Share bill to customer WhatsApp on completion' },
          { key: 'sms_bill', label: 'Send bill via SMS', desc: 'Send bill SMS to customer phone' },
        ] as const
      ).map(({ key, label, desc }) => (
        <div
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", marginBottom: 2 }}>
              {label}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>{desc}</p>
          </div>
          <Toggle checked={form[key]} onChange={val => set(key, val)} />
        </div>
      ))}

      <div style={{ marginTop: 16, marginBottom: 20 }}>
        <FieldRow label="Ordering mode">
          <select
            style={inputStyle}
            value={form.ordering_mode}
            onChange={e => set('ordering_mode', e.target.value)}
          >
            <option value="SELF">SELF — customers order themselves</option>
            <option value="WAITER">WAITER — staff place orders</option>
            <option value="HYBRID">HYBRID — both</option>
          </select>
        </FieldRow>

        <FieldRow label="Order timeout (minutes)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={1}
              max={60}
              style={{ ...inputStyle, width: 80 }}
              value={form.order_timeout_minutes}
              onChange={e => set('order_timeout_minutes', Number(e.target.value))}
            />
            <span style={{ fontSize: 12, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
              Pending orders auto-cancel after this many minutes if not accepted
            </span>
          </div>
        </FieldRow>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          style={{ ...saveButtonStyle, opacity: saveMutation.isPending ? 0.6 : 1 }}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <SavedBadge show={saved} />
        {saveMutation.isError && (
          <span style={{ fontSize: 13, color: 'var(--red)', fontFamily: "'Geist', sans-serif" }}>
            Failed to save
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section: Payments & Tax ──────────────────────────────────────────────────

function PaymentsSection({ data, onRefetch }: { data: RestaurantSettings; onRefetch: () => void }) {
  // API stores gst_rate as a decimal (0.05 = 5%). Convert to percentage for the UI dropdown.
  const [form, setForm] = useState({
    upi_id: data.upi_id || '',
    gst_rate: String(Math.round((data.gst_rate ?? 0) * 100)),
  });
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: { upi_id: string; gst_rate: number }) =>
      api.patch('/restaurants/me', payload),
    onSuccess: () => {
      onRefetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div>
      <p style={sectionLabelStyle}>Payments &amp; Tax</p>

      <FieldRow label="UPI ID">
        <input
          style={inputStyle}
          value={form.upi_id}
          placeholder="e.g. restaurant@upi"
          onChange={e => setForm(prev => ({ ...prev, upi_id: e.target.value }))}
        />
      </FieldRow>

      <FieldRow label="GST Rate">
        <select
          style={inputStyle}
          value={form.gst_rate}
          onChange={e => setForm(prev => ({ ...prev, gst_rate: e.target.value }))}
        >
          <option value="0">0% — No GST</option>
          <option value="5">5%</option>
          <option value="12">12%</option>
          <option value="18">18%</option>
        </select>
      </FieldRow>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <button
          onClick={() =>
            // API expects decimal: 5% → 0.05
            mutation.mutate({ upi_id: form.upi_id, gst_rate: Number(form.gst_rate) / 100 })
          }
          disabled={mutation.isPending}
          style={{ ...saveButtonStyle, opacity: mutation.isPending ? 0.6 : 1 }}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <SavedBadge show={saved} />
        {mutation.isError && (
          <span style={{ fontSize: 13, color: 'var(--red)', fontFamily: "'Geist', sans-serif" }}>
            Failed to save
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section: Holidays ────────────────────────────────────────────────────────

function HolidaysSection({ data, onRefetch }: { data: RestaurantSettings; onRefetch: () => void }) {
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (payload: { date: string; reason: string; note?: string }) =>
      api.post('/restaurants/me/holidays', payload),
    onSuccess: () => {
      onRefetch();
      setNewDate('');
      setNewReason('');
      setNewNote('');
      setAddError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setAddError(axiosErr.response?.data?.message || axiosErr.message || 'Failed to add holiday');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/restaurants/me/holidays/${id}`),
    onSuccess: onRefetch,
  });

  const holidays = data.holidays || [];

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div>
      <p style={sectionLabelStyle}>Holidays &amp; Closures</p>

      {/* Existing holidays */}
      {holidays.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--ink5)', fontFamily: "'Geist', sans-serif", marginBottom: 24, fontStyle: 'italic' }}>
          No holidays scheduled
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {holidays.map(h => (
            <div
              key={h.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                background: 'var(--paper2, #f5f5f5)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", marginBottom: 2 }}>
                  {h.reason}
                </p>
                <p style={{ fontSize: 13, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
                  {formatDate(h.date)}
                </p>
                {h.note && (
                  <p style={{ fontSize: 12, color: 'var(--ink5)', fontFamily: "'Geist', sans-serif", marginTop: 2 }}>
                    {h.note}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(h.id)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: 'var(--red-bg, #fef2f2)',
                  color: 'var(--red, #dc2626)',
                  border: '1px solid rgba(220,38,38,0.15)',
                  fontSize: 12,
                  fontFamily: "'Geist', sans-serif",
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: 500,
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add holiday form */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px',
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          Add holiday
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <FieldRow label="Date">
            <input
              type="date"
              style={inputStyle}
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Reason">
            <input
              style={inputStyle}
              placeholder="e.g. Diwali"
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
            />
          </FieldRow>
        </div>

        <FieldRow label="Note (optional)">
          <input
            style={inputStyle}
            placeholder="Any additional note"
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
          />
        </FieldRow>

        {addError && (
          <p style={{ fontSize: 13, color: 'var(--red)', fontFamily: "'Geist', sans-serif", marginBottom: 10 }}>
            {addError}
          </p>
        )}

        <button
          onClick={() => {
            if (!newDate || !newReason.trim()) {
              setAddError('Date and reason are required');
              return;
            }
            addMutation.mutate({ date: newDate, reason: newReason.trim(), note: newNote.trim() || undefined });
          }}
          disabled={addMutation.isPending}
          style={{ ...saveButtonStyle, opacity: addMutation.isPending ? 0.6 : 1 }}
        >
          {addMutation.isPending ? 'Adding…' : 'Add holiday'}
        </button>
      </div>
    </div>
  );
}

// ─── Discount Card ────────────────────────────────────────────────────────────

function DiscountCard({
  discount,
  onToggle,
  onDelete,
  toggling,
  deleting,
}: {
  discount: Discount;
  onToggle: () => void;
  onDelete: () => void;
  toggling: boolean;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valueLabel =
    discount.type === 'PERCENTAGE'
      ? `${Number(discount.value)}% off`
      : `₹${Number(discount.value).toFixed(0)} off`;

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${discount.is_active ? 'var(--border)' : 'var(--border2, #e8e8e8)'}`,
        borderRadius: 10,
        padding: '12px 14px',
        opacity: discount.is_active ? 1 : 0.65,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + value badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: "'Geist', sans-serif" }}>
            {discount.name}
          </span>
          <span
            style={{
              fontSize: 12, fontWeight: 700,
              background: discount.type === 'PERCENTAGE' ? '#EFF6FF' : '#F0FDF4',
              color: discount.type === 'PERCENTAGE' ? '#1D4ED8' : '#166534',
              padding: '1px 8px', borderRadius: 20,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {valueLabel}
          </span>
          {discount.code && (
            <span
              style={{
                fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#92400E',
                padding: '1px 8px', borderRadius: 20, letterSpacing: '0.05em',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {discount.code}
            </span>
          )}
          {!discount.is_active && (
            <span style={{ fontSize: 11, background: '#F5F5F5', color: '#999', padding: '1px 7px', borderRadius: 20, fontFamily: "'Geist', sans-serif" }}>
              Inactive
            </span>
          )}
        </div>

        {/* Meta info row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {discount.max_discount_cap != null && (
            <span style={{ fontSize: 11, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
              Cap ₹{Number(discount.max_discount_cap).toFixed(0)}
            </span>
          )}
          {discount.min_order_amount != null && (
            <span style={{ fontSize: 11, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
              Min ₹{Number(discount.min_order_amount).toFixed(0)}
            </span>
          )}
          {discount.max_uses_total != null && (
            <span style={{ fontSize: 11, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
              {discount.current_uses}/{discount.max_uses_total} uses
            </span>
          )}
          {discount.valid_until && (
            <span style={{ fontSize: 11, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
              Expires{' '}
              {new Date(discount.valid_until).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          )}
          {discount.menuItem && (
            <span style={{ fontSize: 11, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
              Item: {discount.menuItem.name}
            </span>
          )}
          {discount.category && (
            <span style={{ fontSize: 11, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
              Category: {discount.category.name}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Toggle checked={discount.is_active} onChange={onToggle} disabled={toggling} />
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'var(--red, #dc2626)', color: '#fff', border: 'none',
                cursor: 'pointer', fontFamily: "'Geist', sans-serif",
                opacity: deleting ? 0.6 : 1,
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontSize: 11,
                background: '#fff', color: 'var(--ink4)', border: '1px solid var(--border)',
                cursor: 'pointer', fontFamily: "'Geist', sans-serif",
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11,
              background: 'var(--red-bg, #fef2f2)', color: 'var(--red, #dc2626)',
              border: '1px solid rgba(220,38,38,0.15)', cursor: 'pointer',
              fontFamily: "'Geist', sans-serif",
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section: Discounts & Coupons ─────────────────────────────────────────────

type DiscountTab = 'presets' | 'coupons' | 'items';

function DiscountsSection() {
  const queryClient = useQueryClient();
  const [dTab, setDTab] = useState<DiscountTab>('presets');
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Single form state for all 3 tab types
  const blankForm = {
    name: '', type: 'PERCENTAGE', value: '',
    max_discount_cap: '', min_order_amount: '',
    // coupons only
    code: '', max_uses_total: '', valid_until: '',
    // items only
    scope: 'SPECIFIC_ITEM', applied_by_item: 'WAITER_MANUAL',
    menu_item_id: '', category_id: '',
  };
  const [form, setForm] = useState(blankForm);
  const [formErr, setFormErr] = useState('');

  function setF<K extends keyof typeof blankForm>(key: K, val: string) {
    setForm(p => ({ ...p, [key]: val }));
  }

  // ── Fetch all discounts once; filter per tab client-side ──────────────────
  const { data: allDiscounts = [], isLoading } = useQuery<Discount[]>({
    queryKey: ['discounts', 'all'],
    queryFn: () => api.get('/discounts').then(r => r.data),
  });

  const presets      = allDiscounts.filter(d => d.applied_by === 'WAITER_MANUAL' && d.scope === 'ENTIRE_ORDER');
  const coupons      = allDiscounts.filter(d => d.applied_by === 'COUPON_CODE');
  const itemDiscount = allDiscounts.filter(d => d.scope === 'SPECIFIC_ITEM' || d.scope === 'CATEGORY');

  const tabItems = dTab === 'presets' ? presets : dTab === 'coupons' ? coupons : itemDiscount;

  // ── Fetch menu categories for item tab selectors ──────────────────────────
  const { data: categories = [] } = useQuery<{ id: string; name: string; menuItems: { id: string; name: string }[] }[]>({
    queryKey: ['menu-categories-settings'],
    queryFn: () => api.get('/menu/categories').then(r => r.data),
    enabled: dTab === 'items' && showForm,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/discounts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      setShowForm(false);
      setForm(blankForm);
      setFormErr('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setFormErr(e?.response?.data?.message || 'Failed to create discount');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/discounts/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/discounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] }),
  });

  // ── Generate coupon code from API ─────────────────────────────────────────
  async function handleGenerateCode() {
    setGenerating(true);
    try {
      const res = await api.get('/discounts/generate-code');
      setF('code', res.data.code);
    } finally {
      setGenerating(false);
    }
  }

  // ── Build create payload and validate ─────────────────────────────────────
  function handleCreate() {
    setFormErr('');
    const name  = form.name.trim();
    const value = parseFloat(form.value);
    if (!name)                              return setFormErr('Name is required');
    if (isNaN(value) || value < 0)          return setFormErr('Enter a valid discount value (≥ 0)');
    if (form.type === 'PERCENTAGE' && value > 100) return setFormErr('Percentage cannot exceed 100');

    const payload: Record<string, unknown> = { name, type: form.type, value, is_active: true };

    const cap = parseFloat(form.max_discount_cap);
    const min = parseFloat(form.min_order_amount);
    if (!isNaN(cap) && cap > 0) payload.max_discount_cap  = cap;
    if (!isNaN(min) && min > 0) payload.min_order_amount  = min;

    if (dTab === 'presets') {
      payload.scope      = 'ENTIRE_ORDER';
      payload.applied_by = 'WAITER_MANUAL';

    } else if (dTab === 'coupons') {
      const code = form.code.trim().toUpperCase();
      if (!code) return setFormErr('Coupon code is required');
      payload.scope      = 'ENTIRE_ORDER';
      payload.applied_by = 'COUPON_CODE';
      payload.code       = code;
      const uses = parseInt(form.max_uses_total, 10);
      if (!isNaN(uses) && uses > 0) payload.max_uses_total = uses;
      if (form.valid_until) payload.valid_until = form.valid_until;

    } else {
      // items tab
      payload.scope      = form.scope;
      payload.applied_by = form.applied_by_item;
      if (form.scope === 'SPECIFIC_ITEM') {
        if (!form.menu_item_id) return setFormErr('Select a menu item');
        payload.menu_item_id = form.menu_item_id;
      } else {
        if (!form.category_id) return setFormErr('Select a category');
        payload.category_id = form.category_id;
      }
    }

    createMutation.mutate(payload);
  }

  // ── Sub-tab pill style ────────────────────────────────────────────────────
  const pillStyle = (id: DiscountTab): React.CSSProperties => ({
    padding: '7px 15px', borderRadius: 20, border: 'none', cursor: 'pointer',
    background: dTab === id ? 'var(--ink)' : 'var(--paper2, #f5f5f5)',
    color: dTab === id ? '#fff' : 'var(--ink4)',
    fontSize: 12, fontWeight: 600, fontFamily: "'Geist', sans-serif",
    transition: 'all 0.15s',
  });

  const tabDesc: Record<DiscountTab, string> = {
    presets: 'One-click presets staff can apply during billing — e.g. 10% loyalty, ₹50 flat off.',
    coupons: 'Shareable codes customers or staff enter at checkout. Track usage and expiry.',
    items:   'Discounts on specific menu items or entire categories, applied automatically or manually.',
  };

  const newLabel: Record<DiscountTab, string> = {
    presets: 'New Preset',
    coupons: 'New Coupon',
    items:   'New Item Discount',
  };

  const emptyIcon: Record<DiscountTab, string> = {
    presets: '⚡', coupons: '🎟', items: '🍽',
  };

  return (
    <div>
      <p style={sectionLabelStyle}>Discounts &amp; Coupons</p>

      {/* Sub-tab pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button style={pillStyle('presets')} onClick={() => { setDTab('presets'); setShowForm(false); setForm(blankForm); }}>
          ⚡ Quick Presets
        </button>
        <button style={pillStyle('coupons')} onClick={() => { setDTab('coupons'); setShowForm(false); setForm(blankForm); }}>
          🎟 Coupon Codes
        </button>
        <button style={pillStyle('items')} onClick={() => { setDTab('items'); setShowForm(false); setForm(blankForm); }}>
          🍽 Item Discounts
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif", marginBottom: 20 }}>
        {tabDesc[dTab]}
      </p>

      {/* Discount list */}
      {isLoading ? (
        <div style={{ marginBottom: 16 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: 68, borderRadius: 10, background: 'var(--paper3)', marginBottom: 8 }} />
          ))}
        </div>
      ) : tabItems.length === 0 && !showForm ? (
        <div style={{
          padding: '28px 16px', textAlign: 'center',
          border: '1.5px dashed var(--border)', borderRadius: 10, marginBottom: 16,
        }}>
          <p style={{ fontSize: 26, marginBottom: 6 }}>{emptyIcon[dTab]}</p>
          <p style={{ fontSize: 13, color: 'var(--ink4)', fontFamily: "'Geist', sans-serif" }}>
            No {dTab === 'presets' ? 'quick presets' : dTab === 'coupons' ? 'coupon codes' : 'item discounts'} yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--ink5)', fontFamily: "'Geist', sans-serif", marginTop: 4 }}>
            Click &ldquo;{newLabel[dTab]}&rdquo; below to create one
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {tabItems.map(d => (
            <DiscountCard
              key={d.id}
              discount={d}
              onToggle={() => toggleMutation.mutate({ id: d.id, is_active: !d.is_active })}
              onDelete={() => deleteMutation.mutate(d.id)}
              toggling={toggleMutation.isPending}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Create form ─── */}
      {showForm ? (
        <div style={{ background: 'var(--paper2, #f5f5f5)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", marginBottom: 16 }}>
            New {newLabel[dTab]}
          </p>

          {/* Name */}
          <FieldRow label="Name">
            <input
              style={inputStyle}
              placeholder={
                dTab === 'presets' ? 'e.g. Staff Discount 10%' :
                dTab === 'coupons' ? 'e.g. Welcome Offer' :
                'e.g. Tuesday Special'
              }
              value={form.name}
              onChange={e => setF('name', e.target.value)}
            />
          </FieldRow>

          {/* Coupon code field */}
          {dTab === 'coupons' && (
            <FieldRow label="Coupon Code">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  placeholder="e.g. WELCOME20"
                  value={form.code}
                  onChange={e => setF('code', e.target.value.toUpperCase())}
                />
                <button
                  onClick={handleGenerateCode}
                  disabled={generating}
                  style={{
                    ...saveButtonStyle, padding: '9px 14px', fontSize: 13, whiteSpace: 'nowrap',
                    background: '#fff', color: 'var(--ink)', border: '1px solid var(--border)',
                    opacity: generating ? 0.6 : 1,
                  }}
                >
                  🎲 Generate
                </button>
              </div>
            </FieldRow>
          )}

          {/* Item / Category selectors (items tab only) */}
          {dTab === 'items' && (
            <>
              <FieldRow label="Scope">
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { v: 'SPECIFIC_ITEM', l: '🍽 Specific Item' },
                    { v: 'CATEGORY',      l: '📂 Category' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setForm(p => ({ ...p, scope: opt.v, menu_item_id: '', category_id: '' }))}
                      style={{
                        padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        fontFamily: "'Geist', sans-serif",
                        ...(form.scope === opt.v
                          ? { background: 'var(--ink)', color: '#fff', border: 'none' }
                          : { background: '#fff', color: 'var(--ink4)', border: '1px solid var(--border)' }),
                      }}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </FieldRow>

              {form.scope === 'SPECIFIC_ITEM' ? (
                <FieldRow label="Menu Item">
                  <select
                    style={inputStyle}
                    value={form.menu_item_id}
                    onChange={e => setF('menu_item_id', e.target.value)}
                  >
                    <option value="">Select item…</option>
                    {categories.map(cat => (
                      <optgroup key={cat.id} label={cat.name}>
                        {cat.menuItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </FieldRow>
              ) : (
                <FieldRow label="Category">
                  <select
                    style={inputStyle}
                    value={form.category_id}
                    onChange={e => setF('category_id', e.target.value)}
                  >
                    <option value="">Select category…</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </FieldRow>
              )}

              <FieldRow label="Applied by">
                <select
                  style={inputStyle}
                  value={form.applied_by_item}
                  onChange={e => setF('applied_by_item', e.target.value)}
                >
                  <option value="WAITER_MANUAL">Waiter (manual — added during billing)</option>
                  <option value="CUSTOMER_AUTO">Customer (auto-applied on qualifying orders)</option>
                </select>
              </FieldRow>
            </>
          )}

          {/* Type + Value */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldRow label="Discount Type">
              <select style={inputStyle} value={form.type} onChange={e => setF('type', e.target.value)}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              </select>
            </FieldRow>
            <FieldRow label={form.type === 'PERCENTAGE' ? 'Value (0–100%)' : 'Value (₹)'}>
              <input
                type="number" min="0" step={form.type === 'PERCENTAGE' ? 1 : 0.5}
                max={form.type === 'PERCENTAGE' ? 100 : undefined}
                style={inputStyle}
                placeholder={form.type === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 50'}
                value={form.value}
                onChange={e => setF('value', e.target.value)}
              />
            </FieldRow>
          </div>

          {/* Optional constraints */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {form.type === 'PERCENTAGE' && (
              <FieldRow label="Max Discount Cap ₹ — optional">
                <input
                  type="number" min="0" step="1"
                  style={inputStyle} placeholder="e.g. 200 (limit ₹ saved)"
                  value={form.max_discount_cap}
                  onChange={e => setF('max_discount_cap', e.target.value)}
                />
              </FieldRow>
            )}
            <FieldRow label="Min Order Amount ₹ — optional">
              <input
                type="number" min="0" step="1"
                style={inputStyle} placeholder="e.g. 500 (minimum to qualify)"
                value={form.min_order_amount}
                onChange={e => setF('min_order_amount', e.target.value)}
              />
            </FieldRow>
          </div>

          {/* Coupon-only constraints */}
          {dTab === 'coupons' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FieldRow label="Max Total Uses — optional">
                <input
                  type="number" min="1" step="1"
                  style={inputStyle} placeholder="Unlimited"
                  value={form.max_uses_total}
                  onChange={e => setF('max_uses_total', e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Valid Until — optional">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.valid_until}
                  onChange={e => setF('valid_until', e.target.value)}
                />
              </FieldRow>
            </div>
          )}

          {formErr && (
            <p style={{ fontSize: 13, color: 'var(--red)', fontFamily: "'Geist', sans-serif", marginBottom: 12 }}>
              ⚠ {formErr}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              style={{ ...saveButtonStyle, opacity: createMutation.isPending ? 0.6 : 1 }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(blankForm); setFormErr(''); }}
              style={{
                ...saveButtonStyle, background: '#fff', color: 'var(--ink)',
                border: '1px solid var(--border)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowForm(true); setForm(blankForm); setFormErr(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8,
            background: 'var(--accent, var(--ink))', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600,
            fontFamily: "'Geist', sans-serif", cursor: 'pointer',
          }}
        >
          + {newLabel[dTab]}
        </button>
      )}
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

type SettingsTab = 'info' | 'hours' | 'ordering' | 'payments' | 'holidays' | 'discounts';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'info',      label: 'Restaurant Info',      icon: '🏪' },
  { id: 'hours',     label: 'Business Hours',        icon: '🕐' },
  { id: 'ordering',  label: 'Ordering',              icon: '📋' },
  { id: 'payments',  label: 'Payments & Tax',        icon: '💳' },
  { id: 'holidays',  label: 'Holidays',              icon: '📅' },
  { id: 'discounts', label: 'Discounts & Coupons',   icon: '🏷' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('info');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<RestaurantSettings>({
    queryKey: ['restaurant', 'settings'],
    queryFn: () => api.get('/restaurants/me').then(r => r.data),
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant', 'settings'] });
  }, [queryClient]);

  if (isLoading) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ height: 28, width: 140, borderRadius: 6, background: 'var(--paper3)', marginBottom: 28 }} />
        {/* Tab bar skeleton */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
          {[100, 120, 90, 120, 80].map((w, i) => (
            <div key={i} style={{ width: w, height: 36, borderRadius: 6, background: 'var(--paper3)', marginBottom: 8 }} />
          ))}
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 14, borderRadius: 4, background: 'var(--paper3)', marginBottom: 16, width: i === 3 ? '60%' : '100%' }} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, color: 'var(--red)' }}>
          Failed to load settings. Please refresh.
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      <div style={{ padding: '28px 32px', background: 'var(--paper, #fafaf9)', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ maxWidth: 700 }}>

          {/* Page title */}
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 28,
            color: 'var(--ink)',
            marginBottom: 20,
          }}>
            Settings
          </h1>

          {/* ── Tab bar ── */}
          <div style={{
            display: 'flex',
            gap: 2,
            borderBottom: '1px solid var(--border)',
            marginBottom: 24,
            overflowX: 'auto',
          }}>
            {SETTINGS_TABS.map(({ id, label, icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    padding: '9px 16px',
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
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s, border-color 0.15s',
                    marginBottom: -1,
                  }}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* ── Tab content ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', padding: '24px' }}>
            {activeTab === 'info'      && <RestaurantInfoSection data={data} onRefetch={refetch} />}
            {activeTab === 'hours'     && <BusinessHoursSection  data={data} onRefetch={refetch} />}
            {activeTab === 'ordering'  && <OrderingSection       data={data} onRefetch={refetch} />}
            {activeTab === 'payments'  && <PaymentsSection       data={data} onRefetch={refetch} />}
            {activeTab === 'holidays'  && <HolidaysSection       data={data} onRefetch={refetch} />}
            {activeTab === 'discounts' && <DiscountsSection />}
          </div>

        </div>
      </div>
    </>
  );
}
