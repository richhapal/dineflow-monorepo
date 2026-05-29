/**
 * Image URL helpers for Cloudflare R2.
 *
 * Defined here (not in @dineflow/utils) so Next.js webpack can inline
 * NEXT_PUBLIC_R2_PUBLIC_BASE_URL at build time without any module-load
 * timing issues from shared packages.
 */

const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

/**
 * Returns the public URL for an R2 image key.
 * Falls back to empty string if no base URL is configured (shows placeholder).
 */
export function menuImage(publicId: string | null | undefined): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;  // already absolute URL
  if (!R2_BASE) return '';
  return `${R2_BASE}/${publicId}`;
}

/**
 * Returns true only for valid R2 object keys (start with "restaurants/").
 * Guards against old Cloudinary public_ids still in the database.
 */
export function isR2Image(publicId: string | null | undefined): boolean {
  return !!publicId && publicId.startsWith('restaurants/');
}
