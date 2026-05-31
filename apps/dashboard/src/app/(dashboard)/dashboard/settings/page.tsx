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
  const [form, setForm] = useState({
    upi_id: data.upi_id || '',
    gst_rate: String(data.gst_rate ?? 0),
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
            mutation.mutate({ upi_id: form.upi_id, gst_rate: Number(form.gst_rate) })
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

// ─── Main Settings Page ───────────────────────────────────────────────────────

type Tab = 'info' | 'hours' | 'ordering' | 'payments' | 'holidays';

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Restaurant Info' },
  { id: 'hours', label: 'Business Hours' },
  { id: 'ordering', label: 'Ordering Settings' },
  { id: 'payments', label: 'Payments & Tax' },
  { id: 'holidays', label: 'Holidays' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('info');
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
      <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
        {/* Sidebar skeleton */}
        <div style={{ width: 200, borderRight: '1px solid var(--border)', background: '#fff', padding: '24px 16px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{
                height: 14,
                borderRadius: 4,
                background: 'var(--paper3)',
                marginBottom: 20,
                width: i === 2 ? '80%' : i === 4 ? '70%' : '90%',
              }}
            />
          ))}
        </div>
        {/* Content skeleton */}
        <div style={{ flex: 1, padding: 28 }}>
          <div style={{ height: 24, width: 120, borderRadius: 6, background: 'var(--paper3)', marginBottom: 28 }} />
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 14, borderRadius: 4, background: 'var(--paper3)', marginBottom: 16, width: i === 3 ? '60%' : '100%' }} />
          ))}
        </div>
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
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        {/* ── Left sidebar ── */}
        <nav style={{
          width: 200,
          flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid var(--border)',
          padding: '20px 0',
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 18px',
                  fontSize: 14,
                  fontFamily: "'Geist', sans-serif",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent)' : 'var(--ink3)',
                  background: isActive ? 'var(--accent-bg, #f0faf4)' : 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'background 0.15s, color 0.15s',
                  display: 'block',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* ── Content area ── */}
        <div style={{ flex: 1, padding: '28px 32px', background: 'var(--paper, #fafaf9)', overflowY: 'auto' }}>
          <div style={{ maxWidth: 640 }}>
            {/* Page title */}
            <h1 style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 28,
              color: 'var(--ink)',
              marginBottom: 28,
            }}>
              Settings
            </h1>

            {/* Tab content */}
            {activeTab === 'info' && (
              <div style={{ background: '#fff', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border)', padding: '24px' }}>
                <RestaurantInfoSection data={data} onRefetch={refetch} />
              </div>
            )}

            {activeTab === 'hours' && (
              <div style={{ background: '#fff', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border)', padding: '24px' }}>
                <BusinessHoursSection data={data} onRefetch={refetch} />
              </div>
            )}

            {activeTab === 'ordering' && (
              <div style={{ background: '#fff', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border)', padding: '24px' }}>
                <OrderingSection data={data} onRefetch={refetch} />
              </div>
            )}

            {activeTab === 'payments' && (
              <div style={{ background: '#fff', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border)', padding: '24px' }}>
                <PaymentsSection data={data} onRefetch={refetch} />
              </div>
            )}

            {activeTab === 'holidays' && (
              <div style={{ background: '#fff', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border)', padding: '24px' }}>
                <HolidaysSection data={data} onRefetch={refetch} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
