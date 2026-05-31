import { notFound } from 'next/navigation';
import MenuPage from './MenuPage';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface QRData {
  id: string;
  slug: string;
  label: string;
  table: { id: string; name: string; section: string } | null;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_public_id: string | null;
    theme_config: Record<string, unknown> | null;
    is_ordering_enabled: boolean;
    ordering_mode: string;
  };
}

interface MenuData {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_public_id: string | null;
    is_open: boolean;
  };
  availability: { is_open: boolean; message?: string };
  categories: Array<{
    id: string;
    name: string;
    menuItems: Array<{
      id: string;
      name: string;
      description: string | null;
      base_price: number;
      food_type: string | null;
      image_public_id: string | null;
      is_bestseller: boolean;
      variants: Array<{
        id: string;
        name: string;
        price: number;
        is_default: boolean;
      }>;
      addonGroups: Array<{
        id: string;
        name: string;
        addons: Array<{ id: string; name: string; price: number }>;
      }>;
    }>;
  }>;
  collections: unknown[];
}

export default async function MenuSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  let qrData: QRData;
  let menuData: MenuData;

  try {
    const qrRes = await fetch(`${API}/qr/scan/${params.slug}`, {
      cache: 'no-store',
    });
    if (!qrRes.ok) return notFound();
    qrData = await qrRes.json();
  } catch {
    return notFound();
  }

  try {
    const menuRes = await fetch(
      `${API}/menu/public/${qrData.restaurant.slug}`,
      { cache: 'no-store' }
    );
    if (!menuRes.ok) return notFound();
    menuData = await menuRes.json();
  } catch {
    return notFound();
  }

  return (
    <MenuPage
      qrData={qrData}
      menuData={menuData}
      slug={params.slug}
    />
  );
}
