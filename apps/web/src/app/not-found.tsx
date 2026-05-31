export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 12,
        padding: '0 24px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'Instrument Serif', fontSize: 28, color: 'var(--ink)' }}>
        QR code not found
      </h1>
      <p style={{ color: 'var(--ink4)', fontSize: 14, lineHeight: 1.6 }}>
        This QR code is no longer valid or doesn&apos;t exist. Please ask staff for a new one.
      </p>
    </div>
  );
}
