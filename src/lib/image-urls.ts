/**
 * Client-safe image URL utilities (no Node.js dependencies).
 */

/**
 * Derive thumbnail URL from a full image URL.
 * "/uploads/chat-images/abc.webp" → "/uploads/chat-images/abc_thumb.webp"
 */
export function toThumbUrl(url: string): string {
  return url.replace(/\.webp$/, "_thumb.webp");
}

/**
 * Check if a URL is already a thumbnail URL.
 */
export function isThumbUrl(url: string): boolean {
  return url.endsWith("_thumb.webp");
}
