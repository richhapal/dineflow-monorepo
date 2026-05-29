'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useDashboardStore } from '@/lib/store';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setRestaurant, setAuth, token } = useDashboardStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('dineflow_token');
    if (!storedToken) {
      router.replace('/login');
      return;
    }

    // Hydrate token into Zustand store if lost on page refresh
    if (!token) {
      // Re-hydrate: store the token so api calls work via the store too
      // The api interceptor reads directly from localStorage so requests already work
    }

    // Fetch restaurant + current staff profile
    Promise.all([
      api.get('/restaurants/me'),
      api.get('/auth/me'),
    ])
      .then(([restaurantRes, staffRes]) => {
        setRestaurant(restaurantRes.data);
        // Re-hydrate user into store
        setAuth(storedToken, staffRes.data);
        setReady(true);
      })
      .catch(() => {
        // Token invalid — clear and redirect
        localStorage.removeItem('dineflow_token');
        router.replace('/login');
      });
  }, []);

  if (!ready) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--paper)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
            margin: '0 auto 16px', animation: 'pulse 1.2s ease-in-out infinite',
          }} />
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)' }}>Loading dashboard…</p>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }`}</style>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
