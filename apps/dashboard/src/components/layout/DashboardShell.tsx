'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboardStore } from '@/lib/store';

const NAV_ITEMS = [
  { icon: '🏠', label: 'Dashboard', href: '/dashboard' },
  { icon: '⚡', label: 'Live orders', href: '/dashboard/orders', liveCount: true },
];

const RESTAURANT_ITEMS = [
  { icon: '🍽', label: 'Menu', href: '/dashboard/menu' },
  { icon: '▦', label: 'Tables & QR', href: '/dashboard/tables' },
  { icon: '🧾', label: 'Billing', href: '/dashboard/billing' },
];

const SOON_ITEMS = [
  { icon: '📊', label: 'Analytics', href: '/dashboard/analytics' },
  { icon: '👥', label: 'Staff', href: '/dashboard/staff' },
  { icon: '📦', label: 'Inventory', href: '/dashboard/inventory' },
];

const SETTINGS_ITEMS = [
  { icon: '⚙', label: 'Settings', href: '/dashboard/settings' },
  { icon: '🎨', label: 'Themes', href: '/dashboard/themes' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function NavItem({ icon, label, href, badge, soonBadge }: {
  icon: string; label: string; href: string;
  badge?: React.ReactNode; soonBadge?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: isActive ? '7px 10px 7px 7px' : '7px 10px',
      borderRadius: 8,
      fontSize: 13.5, color: isActive ? 'var(--accent)' : 'var(--ink3)',
      cursor: 'pointer', textDecoration: 'none', marginBottom: 1,
      background: isActive ? 'var(--accent-bg)' : 'transparent',
      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
      marginLeft: isActive ? -3 : 0,
      fontWeight: isActive ? 500 : 400,
      transition: 'all .15s',
    }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--paper3)'; e.currentTarget.style.color = 'var(--ink)'; } }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink3)'; } }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ flex: 1, fontFamily: "'Geist', sans-serif" }}>{label}</span>
      {badge}
      {soonBadge && (
        <span style={{ background: 'var(--paper3)', color: 'var(--ink5)', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontFamily: "'Geist', sans-serif" }}>
          Soon
        </span>
      )}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { restaurant, user, liveOrders } = useDashboardStore();
  const liveCount = liveOrders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status)).length;

  const LiveBadge = liveCount > 0 ? (
    <span style={{
      width: 18, height: 18, borderRadius: '50%', background: '#E63946',
      color: '#fff', fontFamily: "'Geist Mono', monospace", fontSize: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{liveCount}</span>
  ) : null;

  const restaurantInitials = getInitials(restaurant?.name);
  const userInitials = getInitials(user?.name);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        position: 'fixed', left: 0, top: 0, width: 240, height: '100vh',
        background: 'var(--paper)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 50,
      }}>
        {/* Restaurant switcher */}
        <div style={{ padding: '16px 14px', marginBottom: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--paper3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 14, color: 'var(--accent)' }}>
                {restaurantInitials}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {restaurant?.name || 'Your Restaurant'}
              </p>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 11, color: 'var(--ink4)' }}>
                {restaurant?.city || 'Loading…'}
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="var(--ink5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <NavItem key={item.href} icon={item.icon} label={item.label} href={item.href}
              badge={item.liveCount ? LiveBadge : undefined} />
          ))}

          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 600, color: 'var(--ink5)', textTransform: 'uppercase', letterSpacing: '.07em', padding: '12px 8px 4px' }}>
            Restaurant
          </p>
          {RESTAURANT_ITEMS.map(item => (
            <NavItem key={item.href} icon={item.icon} label={item.label} href={item.href} />
          ))}

          {SOON_ITEMS.map(item => (
            <NavItem key={item.href} icon={item.icon} label={item.label} href={item.href} soonBadge />
          ))}

          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 600, color: 'var(--ink5)', textTransform: 'uppercase', letterSpacing: '.07em', padding: '12px 8px 4px' }}>
            Settings
          </p>
          {SETTINGS_ITEMS.map(item => (
            <NavItem key={item.href} icon={item.icon} label={item.label} href={item.href} />
          ))}
        </nav>

        {/* User profile */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#EEEDFE', color: '#3C3489',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 14 }}>{userInitials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'User'}
            </p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: 11, color: 'var(--ink4)' }}>
              {user?.role || 'Owner'}
            </p>
          </div>
          <Link href="/dashboard/settings" style={{ color: 'var(--ink5)', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </Link>
        </div>
      </aside>

      {/* ── Header ── */}
      <header style={{
        position: 'fixed', left: 240, right: 0, height: 56,
        background: '#fff', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', zIndex: 40,
      }}>
        <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 18, color: 'var(--ink)' }}>
          {getGreeting()}, {user?.name?.split(' ')[0] || 'Chef'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Search */}
          <div style={{
            width: 220, height: 34, background: 'var(--paper2)',
            border: '1px solid var(--border)', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="var(--ink5)" strokeWidth="1.5"/>
              <path d="M9.5 9.5L12.5 12.5" stroke="var(--ink5)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input placeholder="Search…" style={{
              background: 'none', border: 'none', outline: 'none',
              fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink5)',
              width: '100%',
            }} />
          </div>
          {/* Bell */}
          <div style={{ position: 'relative' }}>
            <button style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid var(--border)', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5v3L2 11h12l-1.5-2V6A4.5 4.5 0 008 1.5z" stroke="var(--ink3)" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M6.5 13a1.5 1.5 0 003 0" stroke="var(--ink3)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <div style={{
              position: 'absolute', top: 2, right: 2, width: 8, height: 8,
              borderRadius: '50%', background: '#E63946', border: '1.5px solid #fff',
            }} />
          </div>
          {/* Date pill */}
          <div style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink4)',
            background: 'var(--paper3)', border: '1px solid var(--border)',
            borderRadius: 100, padding: '4px 12px',
          }}>
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ marginLeft: 240, paddingTop: 56, minHeight: '100vh', background: 'var(--paper)', flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
