/**
 * lib/utils.ts
 *
 * Shared utility functions.
 */

/**
 * Generate a URL-safe slug from a string.
 * Handles Spanish characters (ñ → n, á → a, etc.).
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    // Remove diacritics (accents, tildes)
    .replace(/[\u0300-\u036f]/g, '')
    // ñ normalizes to n + combining tilde, already stripped above, but be explicit
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Format a numeric price with thousands separators.
 * Uses Argentine locale conventions.
 */
export function formatPrice(
  amount: number,
  currency: 'ARS' | 'USD',
): string {
  const locale = 'es-AR'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format m² area with one decimal.
 */
export function formatArea(m2: number): string {
  return `${m2.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m²`
}

/**
 * Clamp a number within [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Return a Supabase Storage public URL for a given bucket and path.
 * Convenience wrapper — the raw URL is also stored in the DB, but this
 * is useful when you have only the path component.
 */
export function storageUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}

/**
 * Type guard: value is not null or undefined.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Convert a File to a base64 data URL (browser only).
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
