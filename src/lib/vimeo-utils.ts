/**
 * Vimeo URL parsing and embed utilities.
 *
 * Supports:
 *  - https://vimeo.com/VIDEO_ID
 *  - https://www.vimeo.com/VIDEO_ID
 *  - https://player.vimeo.com/video/VIDEO_ID
 *  - https://vimeo.com/channels/CHANNEL/VIDEO_ID
 *  - https://vimeo.com/groups/GROUP/videos/VIDEO_ID
 *  - URLs with extra params (hash, query, etc.)
 */

const VIMEO_REGEX =
  /(?:vimeo\.com\/(?:video\/|channels\/[\w]+\/|groups\/[\w]+\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)/;

/** Extract the numeric video ID from any Vimeo URL, or null if invalid. */
export function extractVimeoVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(VIMEO_REGEX);
  return match?.[1] ?? null;
}

/** Build an embeddable Vimeo URL from a video ID. */
export function buildVimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}`;
}

/** Check whether a string looks like a valid Vimeo URL. */
export function isVimeoUrl(url: string): boolean {
  return extractVimeoVideoId(url) !== null;
}
