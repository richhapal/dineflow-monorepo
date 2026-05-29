'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useDashboardStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      useDashboardStore.getState().setAuth(res.data.access_token, res.data.staff);
      router.push('/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', minHeight: '100vh' }}>
      {/* ── Left dark panel ── */}
      <div style={{ background: '#0C0A08', padding: '64px', position: 'relative', overflow: 'hidden' }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        {/* Radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(184,92,44,.12), transparent 60%)',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B85C2C', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: '#F5EDD8' }}>DineFlow</span>
        </div>

        {/* Center content */}
        <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 64, right: 64, zIndex: 1 }}>
          <p style={{
            fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 500,
            color: '#9A8060', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 20,
          }}>Restaurant management</p>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
            fontSize: 'clamp(36px,4vw,56px)', color: '#F5EDD8', lineHeight: 1.1,
            letterSpacing: '-.03em', marginBottom: 16,
          }}>Your restaurant,<br />beautifully managed.</h1>
          <p style={{
            fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 16,
            color: 'rgba(245,237,216,.5)', marginBottom: 40,
          }}>Live orders. GST billing. Payroll.<br />Everything in one dashboard.</p>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { dot: '#4A9E6A', label: 'Live ordering' },
              { dot: '#C9A96E', label: 'GST billing' },
              { dot: '#7B8AE0', label: '26 languages' },
            ].map(({ dot, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 100, padding: '6px 14px',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'rgba(245,237,216,.7)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom restaurant cards */}
        <div style={{ position: 'absolute', bottom: 48, left: 64, right: 64, display: 'flex', gap: 10, zIndex: 1 }}>
          {[
            { name: 'Lumière Dining', city: 'Bangalore' },
            { name: 'The Spice Route', city: 'Goa' },
            { name: 'Brew Theory', city: 'Udaipur' },
          ].map(({ name, city }) => (
            <div key={name} style={{
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, padding: '10px 14px', flex: 1,
            }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 12, color: '#F5EDD8', marginBottom: 2 }}>{name}</p>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 11, color: 'rgba(245,237,216,.4)', marginBottom: 6 }}>{city}</p>
              <span style={{ fontSize: 11, color: '#C9A96E' }}>★★★★★</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 360, width: '100%', padding: '0 48px' }}>
          {/* Logo dark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 48 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B85C2C' }} />
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: 'var(--ink)' }}>DineFlow</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, color: 'var(--ink)', letterSpacing: '-.02em', marginBottom: 6 }}>Welcome back</h2>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 15, color: 'var(--ink4)' }}>Sign in to your restaurant dashboard</p>
          </div>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink2)', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="hello@restaurant.com" required
                style={{
                  width: '100%', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '10px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14,
                  outline: 'none', transition: 'border .15s',
                }}
                onFocus={e => { e.target.style.border = '1px solid var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(184,92,44,.08)'; }}
                onBlur={e => { e.target.style.border = '1px solid var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink2)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: '100%', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '10px 42px 10px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14,
                    outline: 'none', transition: 'border .15s',
                  }}
                  onFocus={e => { e.target.style.border = '1px solid var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(184,92,44,.08)'; }}
                  onBlur={e => { e.target.style.border = '1px solid var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink4)', fontSize: 14,
                }}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{error}</p>
            )}

            {/* Forgot */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <a href="#" style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>Forgot password?</a>
            </div>

            {/* Sign in button */}
            <button type="submit" disabled={loading} style={{
              width: '100%', height: 44, background: loading ? 'var(--ink3)' : 'var(--ink)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s',
            }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = 'var(--accent)'; }}
              onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = 'var(--ink)'; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink5)' }}>or</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
          </div>

          {/* Google button */}
          <button style={{
            width: '100%', height: 44, border: '1.5px solid var(--border2)',
            borderRadius: 8, background: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink2)',
            transition: 'background .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continue with Google
          </button>

          {/* Bottom link */}
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)', textAlign: 'center', marginTop: 32 }}>
            New restaurant?{' '}
            <a href="#" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Start free trial →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
