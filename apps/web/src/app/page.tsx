export default function Home() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontFamily: 'Instrument Serif', fontSize: 28, color: 'var(--ink)' }}>DineFlow</h1>
      <p style={{ color: 'var(--ink4)', fontSize: 14 }}>Scan a QR code to view your menu</p>
    </div>
  );
}
