export default function MenuLoading() {
  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 'calc(100vh - 56px)' }}>
        {/* Sidebar skeleton */}
        <div style={{ background: 'var(--paper)', borderRight: '1px solid var(--border)', padding: '16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 90, height: 12, borderRadius: 4, background: 'var(--paper3)' }} />
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--paper3)' }} />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              height: 38, margin: '4px 0', borderRadius: 8,
              background: 'linear-gradient(90deg, var(--paper3) 25%, var(--paper2) 50%, var(--paper3) 75%)',
              backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear',
            }} />
          ))}
        </div>

        {/* Grid skeleton */}
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 160, height: 22, borderRadius: 6, background: 'linear-gradient(90deg, var(--paper3) 25%, var(--paper2) 50%, var(--paper3) 75%)', backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 200, height: 36, borderRadius: 8, background: 'linear-gradient(90deg, var(--paper3) 25%, var(--paper2) 50%, var(--paper3) 75%)', backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear' }} />
              <div style={{ width: 100, height: 36, borderRadius: 8, background: 'linear-gradient(90deg, var(--paper3) 25%, var(--paper2) 50%, var(--paper3) 75%)', backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                height: 120, borderRadius: 10,
                background: 'linear-gradient(90deg, var(--paper3) 25%, var(--paper2) 50%, var(--paper3) 75%)',
                backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite linear',
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
