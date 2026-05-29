// ─── Currency ─────────────────────────────────────────────────────────────────

export const formatINR = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const formatINRCompact = (amount: number): string => {
  if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return formatINR(amount);
};

// ─── Date / time ──────────────────────────────────────────────────────────────

export const formatTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateTime = (date: string | Date): string =>
  `${formatDate(date)}, ${formatTime(date)}`;

export const timeAgo = (date: string | Date): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// ─── GST calculation ─────────────────────────────────────────────────────────

export interface GSTBreakdown {
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  gst_rate: number;
}

export const calculateGST = (subtotal: number, gstRate: number): GSTBreakdown => {
  const half = gstRate / 2;
  const cgst = Math.round(subtotal * half * 100) / 100;
  const sgst = cgst;
  return {
    subtotal,
    cgst,
    sgst,
    total: subtotal + cgst + sgst,
    gst_rate: gstRate,
  };
};

// ─── Invoice number ───────────────────────────────────────────────────────────

export const formatInvoiceNumber = (
  restaurantShortId: string,
  seq: number,
  year = new Date().getFullYear(),
): string => `DF-${year}-R${restaurantShortId}-${String(seq).padStart(6, '0')}`;

// ─── Financial year ───────────────────────────────────────────────────────────

export const getFinancialYear = (date = new Date()): string => {
  const month = date.getMonth() + 1; // 1-based
  const year = date.getFullYear();
  return month >= 4 ? `${year}-${year + 1 - 2000}` : `${year - 1}-${year - 2000}`;
};

// ─── R2 / Cloudflare image URL builder ───────────────────────────────────────
// Images are stored at deterministic keys and served from R2 public URL.
// R2 doesn't support on-the-fly transforms — we compress/resize at upload time.
// The `size` param is kept for API compatibility but ignored at runtime.

const R2_BASE =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
     process.env.R2_PUBLIC_BASE_URL)) ||
  '';

export type ImageSize = 'thumb' | 'card' | 'full' | 'hero';

/**
 * Returns the public URL for a menu image stored in Cloudflare R2.
 * `publicId` is the R2 object key (e.g. "restaurants/abc/items/xyz.webp").
 * If it's a full https:// URL (legacy or external), it's returned as-is.
 */
export const menuImage = (publicId: string, _size: ImageSize = 'card'): string => {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;  // already absolute
  if (!R2_BASE) return publicId;                       // fallback: key only
  return `${R2_BASE}/${publicId}`;
};

export const blurPlaceholder = (publicId: string): string => menuImage(publicId);

// ─── Idempotency key ──────────────────────────────────────────────────────────

export const generateIdempotencyKey = (): string => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
};

// ─── Slug ─────────────────────────────────────────────────────────────────────

export const toSlug = (str: string): string =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

// ─── Language ─────────────────────────────────────────────────────────────────

export const RTL_LANGUAGES = ['ur', 'he', 'ar'];

export const isRTL = (langCode: string): boolean =>
  RTL_LANGUAGES.includes(langCode.toLowerCase());
