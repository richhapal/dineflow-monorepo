import { notFound } from 'next/navigation';
import SessionMenuPage from './SessionMenuPage';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function SessionPage({ params }: { params: { slug: string } }) {
  // Fetch session info (table, restaurant, existing orders)
  const sessionRes = await fetch(`${API}/orders/table-session/${params.slug}`, { cache: 'no-store' });
  if (!sessionRes.ok) return notFound();
  const session = await sessionRes.json();

  // Fetch menu using the restaurant slug
  const menuRes = await fetch(`${API}/menu/public/${session.restaurant.slug}`, { cache: 'no-store' });
  if (!menuRes.ok) return notFound();
  const menuData = await menuRes.json();

  return <SessionMenuPage session={session} menuData={menuData} sessionSlug={params.slug} />;
}
