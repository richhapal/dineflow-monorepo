'use client';
import { FoodType } from '@dineflow/types';

// SVG icons following FSSAI food type symbol conventions:
// Veg/Vegan = green square with green circle
// Non-veg/Egg = brown square with brown circle/triangle

function VegIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="#4A7C59" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="3.5" fill="#4A7C59" />
    </svg>
  );
}

function NonVegIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="#993C1D" strokeWidth="1.5" />
      <polygon points="7,3.5 11.5,10.5 2.5,10.5" fill="#993C1D" />
    </svg>
  );
}

function VeganIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="#1D7A4A" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="3.5" fill="#1D7A4A" />
      {/* leaf accent */}
      <path d="M7 4.5 C8.5 4.5 9.5 5.5 9.5 7 C9.5 8.5 8.5 9.5 7 9.5" stroke="#fff" strokeWidth="1" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function EggIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="#B85C2C" strokeWidth="1.5" />
      {/* egg shape */}
      <ellipse cx="7" cy="7.5" rx="3" ry="3.5" fill="#B85C2C" />
    </svg>
  );
}

const OPTIONS: { value: FoodType; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { value: FoodType.VEG,     label: 'Veg',     Icon: VegIcon },
  { value: FoodType.NON_VEG, label: 'Non-veg', Icon: NonVegIcon },
  { value: FoodType.VEGAN,   label: 'Vegan',   Icon: VeganIcon },
  { value: FoodType.EGG,     label: 'Egg',     Icon: EggIcon },
];

interface Props {
  value: FoodType;
  onChange: (v: FoodType) => void;
}

export function FoodTypePicker({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {OPTIONS.map(({ value: opt, label, Icon }) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 100,
              background: active ? 'var(--ink)' : 'var(--paper3)',
              color: active ? '#fff' : 'var(--ink3)',
              border: active ? 'none' : '1px solid var(--border)',
              fontFamily: "'Geist', sans-serif", fontSize: 12,
              fontWeight: active ? 500 : 400,
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
