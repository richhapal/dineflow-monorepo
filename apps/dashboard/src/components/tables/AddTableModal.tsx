'use client';
import React, { useState, useEffect } from 'react';
import { useCreateTable, useUpdateTable, RestaurantTable } from './useTablesQR';
import { useToast } from '@/components/ui/Toast';

interface AddTableModalProps {
  tables: RestaurantTable[];
  editTable?: RestaurantTable | null;
  onClose: () => void;
}

const TABLE_TYPES = [
  { value: 'INDOOR', label: 'Indoor', emoji: '🪑' },
  { value: 'OUTDOOR', label: 'Outdoor', emoji: '🌿' },
  { value: 'BAR', label: 'Bar', emoji: '🍺' },
  { value: 'PRIVATE', label: 'Private', emoji: '🔒' },
] as const;

type TableType = 'INDOOR' | 'OUTDOOR' | 'BAR' | 'PRIVATE';

function suggestNextName(tables: RestaurantTable[]): string {
  const nums = tables
    .map((t) => {
      const m = t.name.match(/T-?(\d+)/i);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `T-${next}`;
}

export default function AddTableModal({
  tables,
  editTable,
  onClose,
}: AddTableModalProps) {
  const { showToast } = useToast();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();

  const isEdit = !!editTable;

  // Form state
  const [name, setName] = useState(editTable?.name ?? suggestNextName(tables));
  const [section, setSection] = useState(editTable?.section ?? '');
  const [newSection, setNewSection] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);
  const [capacity, setCapacity] = useState(editTable?.capacity ?? 4);
  const [tableType, setTableType] = useState<TableType>(
    editTable?.table_type ?? 'INDOOR',
  );
  const [generateQR, setGenerateQR] = useState(!isEdit);
  const [bulkCount, setBulkCount] = useState(1);
  const [bulkMode, setBulkMode] = useState(false);
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);

  // Derive existing sections
  const existingSections = Array.from(
    new Set(tables.map((t) => t.section ?? '').filter(Boolean)),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resolvedSection = showNewSection ? newSection : section;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError('');
    setLoading(true);

    const createPayload = {
      name,
      section: resolvedSection || undefined,
      capacity,
      table_type: tableType,
      generate_qr: generateQR && !bulkMode,
    };

    // edit payload must NOT include generate_qr — API rejects unknown fields
    const editPayload = {
      name,
      section: resolvedSection || undefined,
      capacity,
      table_type: tableType,
    };

    try {
      if (isEdit && editTable) {
        await updateTable.mutateAsync({ id: editTable.id, payload: editPayload });
        showToast({ type: 'success', title: `Table ${name} updated` });
      } else if (bulkMode) {
        // Bulk create
        const promises = Array.from({ length: bulkCount }, (_, i) =>
          createTable.mutateAsync({
            ...createPayload,
            name: `${name}-${i + 1}`,
            generate_qr: generateQR,
          }),
        );
        await Promise.all(promises);
        showToast({
          type: 'success',
          title: `${bulkCount} tables created`,
        });
      } else {
        await createTable.mutateAsync(createPayload);
        showToast({ type: 'success', title: `Table ${name} created` });
      }
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error?.response?.status === 409) {
        setNameError('A table with this name already exists. Please choose a different name.');
      } else {
        showToast({ type: 'error', title: 'Failed to save table' });
      }
    } finally {
      setLoading(false);
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
          width: 440,
          maxWidth: '95vw',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 20,
              color: 'var(--ink)',
            }}
          >
            {isEdit ? `Edit ${editTable.name}` : 'Add table'}
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

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {/* Table name */}
          <label style={labelStyle}>Table name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError('');
            }}
            required
            style={{
              ...inputStyle,
              borderColor: nameError ? 'var(--red)' : 'var(--border)',
            }}
            placeholder="e.g. T-12"
          />
          {nameError && (
            <p
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                color: 'var(--red)',
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              {nameError}
            </p>
          )}

          {/* Section */}
          <label style={{ ...labelStyle, marginTop: 14 }}>Section</label>
          {!showNewSection ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">No section</option>
                {existingSections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSection(true)}
                style={{
                  padding: '8px 12px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: 'var(--ink4)',
                  whiteSpace: 'nowrap',
                }}
              >
                + New section
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Section name"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setShowNewSection(false);
                  setNewSection('');
                }}
                style={{
                  padding: '8px 12px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 12,
                  color: 'var(--ink4)',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Capacity stepper */}
          <label style={{ ...labelStyle, marginTop: 14 }}>Capacity</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setCapacity((c) => Math.max(1, c - 1))}
              style={stepperBtn}
            >
              −
            </button>
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--ink)',
                minWidth: 24,
                textAlign: 'center',
              }}
            >
              {capacity}
            </span>
            <button
              type="button"
              onClick={() => setCapacity((c) => Math.min(20, c + 1))}
              style={stepperBtn}
            >
              +
            </button>
            <span
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 12,
                color: 'var(--ink4)',
              }}
            >
              seats
            </span>
          </div>

          {/* Table type pills */}
          <label style={{ ...labelStyle, marginTop: 14 }}>Table type</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TABLE_TYPES.map(({ value, label, emoji }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTableType(value as TableType)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 100,
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 13,
                  cursor: 'pointer',
                  background:
                    tableType === value ? 'var(--ink)' : 'transparent',
                  color: tableType === value ? '#fff' : 'var(--ink3)',
                  border:
                    tableType === value
                      ? '1.5px solid var(--ink)'
                      : '1.5px solid var(--border)',
                  transition: 'all .15s',
                }}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* Toggles */}
          {!isEdit && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--paper2)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <ToggleRow
                label="Generate QR immediately"
                description="Create a QR code for this table right away"
                checked={generateQR}
                onChange={setGenerateQR}
              />
              <ToggleRow
                label="Bulk create"
                description="Create multiple tables at once"
                checked={bulkMode}
                onChange={setBulkMode}
              />
              {bulkMode && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    paddingLeft: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Geist', sans-serif",
                      fontSize: 12,
                      color: 'var(--ink4)',
                    }}
                  >
                    How many?
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkCount((c) => Math.max(2, c - 1))}
                    style={stepperBtn}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      minWidth: 20,
                      textAlign: 'center',
                    }}
                  >
                    {bulkCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkCount((c) => Math.min(30, c + 1))}
                    style={stepperBtn}
                  >
                    +
                  </button>
                  <span
                    style={{
                      fontFamily: "'Geist', sans-serif",
                      fontSize: 12,
                      color: 'var(--ink4)',
                    }}
                  >
                    tables (names: {name}-1 … {name}-{bulkCount})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 20,
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
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
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 22px',
                background: 'var(--ink)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: "'Geist', sans-serif",
                fontWeight: 500,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : bulkMode
                    ? `Create ${bulkCount} tables`
                    : 'Create table'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        cursor: 'pointer',
        gap: 12,
      }}
    >
      <div>
        <p
          style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--ink)',
            marginBottom: 1,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 11,
            color: 'var(--ink4)',
          }}
        >
          {description}
        </p>
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 100,
          background: checked ? 'var(--ink)' : 'var(--border2)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background .2s',
          marginTop: 2,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .2s',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }}
        />
      </div>
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: "'Geist', sans-serif",
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--ink3)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontFamily: "'Geist', sans-serif",
  fontSize: 14,
  color: 'var(--ink)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const stepperBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: '1.5px solid var(--border)',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: "'Geist', sans-serif",
  fontSize: 16,
  fontWeight: 500,
  color: 'var(--ink)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};
