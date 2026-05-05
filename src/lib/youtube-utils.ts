/**
 * YouTube URL parsing and embed utilities.
 *
 * Supports:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://youtube.com/watch?v=VIDEO_ID
 *  - https://m.youtube.com/watch?v=VIDEO_ID
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/embed/VIDEO_ID
 *  - https://youtube.com/v/VIDEO_ID
 *  - URLs with extra params (timestamp, playlist, etc.)
 */

const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/;

/** Extract the 11-char video ID from any YouTube URL, or null if invalid. */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(YT_REGEX);
  return match?.[1] ?? null;
}

/** Build an embeddable YouTube URL from a video ID. */
export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/** Check whether a string looks like a valid YouTube URL. */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

/** Get the medium-quality thumbnail URL for a YouTube video. */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
