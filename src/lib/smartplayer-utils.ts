/**
 * Smart Player (ScaleUp) URL parsing and embed utilities.
 *
 * Supports:
 *  - https://player.scaleup.com.br/embed/VIDEO_HASH
 *  - Raw 40-character hex hash (SHA-1)
 */

const SP_EMBED_REGEX =
  /player\.scaleup\.com\.br\/embed\/([a-f0-9]{40})/i;

const SP_HASH_REGEX = /^[a-f0-9]{40}$/i;

/** Extract the 40-char video hash from a Smart Player URL or raw hash, or null if invalid. */
export function extractSmartPlayerVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Direct hash
  if (SP_HASH_REGEX.test(trimmed)) return trimmed.toLowerCase();

  // URL or iframe embed code
  const match = trimmed.match(SP_EMBED_REGEX);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Build an embeddable Smart Player URL from a video hash. */
export function buildSmartPlayerEmbedUrl(videoId: string): string {
  return `https://player.scaleup.com.br/embed/${videoId}`;
}

/** Check whether a string looks like a valid Smart Player URL or hash. */
export function isSmartPlayerInput(input: string): boolean {
  return extractSmartPlayerVideoId(input) !== null;
}
