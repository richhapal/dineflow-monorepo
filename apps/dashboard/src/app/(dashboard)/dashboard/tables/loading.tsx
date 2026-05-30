import React from 'react';

function SkeletonBox({
  w,
  h,
  radius,
}: {
  w?: string | number;
  h?: string | number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width: w ?? '100%',
        height: h ?? 16,
        borderRadius: radius ?? 8,
        background:
          'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)',
        backgroundSize: '600px 100%',
        animation: 'shimmer 1.5s infinite linear',
      }}
    />
  );
}

export default function TablesLoading() {
  return (
    <div style={{ padding: 28 }}>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>

      {/* Header skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBox w={220} h={32} radius={8} />
          <SkeletonBox w={140} h={14} radius={6} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SkeletonBox w={130} h={38} radius={8} />
          <SkeletonBox w={130} h={38} radius={8} />
          <SkeletonBox w={160} h={38} radius={8} />
        </div>
      </div>

      {/* Floor plan card skeleton */}
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: 20,
        }}
      >
        {/* Section pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[80, 100, 70].map((w, i) => (
            <SkeletonBox key={i} w={w} h={28} radius={100} />
          ))}
        </div>

        {/* Table grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 12,
          }}
        >
          {[...Array(12)].map((_, i) => (
            <SkeletonBox key={i} h={80} radius={10} />
          ))}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            marginTop: 16,
            flexWrap: 'wrap',
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SkeletonBox w={8} h={8} radius={100} />
              <SkeletonBox w={60} h={12} radius={6} />
            </div>
          ))}
        </div>
      </div>

      {/* QR codes card skeleton */}
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <SkeletonBox w={80} h={20} radius={6} />
          <SkeletonBox w={28} h={20} radius={100} />
        </div>

        {/* Toolbar */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
          }}
        >
          <SkeletonBox w={'40%'} h={34} radius={8} />
          <SkeletonBox w={200} h={34} radius={8} />
          <SkeletonBox w={120} h={34} radius={8} />
        </div>

        {/* Table rows */}
        <div style={{ padding: '0 20px' }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <SkeletonBox w={'15%'} h={16} />
              <SkeletonBox w={'25%'} h={14} />
              <SkeletonBox w={40} h={24} radius={100} />
              <SkeletonBox w={'15%'} h={14} />
              <SkeletonBox w={60} h={22} radius={100} />
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <SkeletonBox w={70} h={28} radius={6} />
                <SkeletonBox w={80} h={28} radius={6} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
