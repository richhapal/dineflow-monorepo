export default function SettingsLoading() {
  const skeletonBox = (w: string | number, h: number, mb?: number) => ({
    width: w,
    height: h,
    borderRadius: 6,
    background: 'linear-gradient(90deg,var(--paper3,#e5e5e5) 25%,var(--paper2,#efefef) 50%,var(--paper3,#e5e5e5) 75%)',
    backgroundSize: '600px 100%',
    animation: 'shimmer 1.5s infinite linear',
    marginBottom: mb ?? 0,
  } as React.CSSProperties);

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
      `}</style>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        {/* Sidebar skeleton */}
        <div style={{
          width: 200,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: '#fff',
          padding: '24px 16px',
        }}>
          {[90, 110, 80, 130, 70].map((w, i) => (
            <div key={i} style={skeletonBox(w, 14, 22)} />
          ))}
        </div>

        {/* Content skeleton */}
        <div style={{ flex: 1, padding: '28px 32px', background: 'var(--paper, #fafaf9)' }}>
          <div style={{ maxWidth: 640 }}>
            {/* Title */}
            <div style={skeletonBox(140, 28, 32)} />

            {/* Card */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: 24,
            }}>
              {/* Section label */}
              <div style={skeletonBox(120, 10, 20)} />

              {/* Fields */}
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ marginBottom: 18 }}>
                  <div style={skeletonBox(80, 10, 8)} />
                  <div style={skeletonBox('100%', 36, 0)} />
                </div>
              ))}

              {/* Two-column row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                {[1, 2].map(i => (
                  <div key={i}>
                    <div style={skeletonBox(60, 10, 8)} />
                    <div style={skeletonBox('100%', 36, 0)} />
                  </div>
                ))}
              </div>

              {/* Save button */}
              <div style={skeletonBox(88, 36, 0)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
