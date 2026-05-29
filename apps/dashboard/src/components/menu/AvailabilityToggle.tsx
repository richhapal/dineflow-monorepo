'use client';
import { useToggleAvailability } from '@/hooks/useMenu';
import type { MenuItem } from '@dineflow/types';

interface Props {
  item: MenuItem;
  categoryId: string;
}

export function AvailabilityToggle({ item, categoryId }: Props) {
  const toggle = useToggleAvailability();
  const pending = toggle.isPending;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) toggle.mutate({ id: item.id, categoryId });
      }}
      title={item.is_available ? 'Available — click to hide' : 'Hidden — click to show'}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: item.is_available ? '#2D7A4A' : 'var(--border2)',
        position: 'relative', cursor: pending ? 'not-allowed' : 'pointer',
        transition: 'background .2s', flexShrink: 0,
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,.4)',
            borderTopColor: '#fff',
            animation: 'spin .6s linear infinite',
          }} />
        </div>
      ) : (
        <div style={{
          position: 'absolute', top: 3,
          left: item.is_available ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
