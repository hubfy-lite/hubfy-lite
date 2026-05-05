import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Image optimization presets
// Supabase render endpoint: /storage/v1/render/image/public/...
// Caches on CDN after first render — subsequent requests are free.
// ---------------------------------------------------------------------------

export type ImagePreset =
  | "cover-card-vertical"    // vitrine/showcase — card vertical (3:4)
  | "cover-card-horizontal"  // vitrine/showcase — card horizontal (16:10)
  | "cover-hero"             // hero banner full-width
  | "lesson-card"            // card de aula na grade do curso (16:9)
  | "lesson-thumb"           // sidebar de aulas (16:9, menor)
  | "admin-thumb"            // miniatura em tabelas admin (quadrado)
  | "admin-card-sm"          // card pequeno no seletor admin
  | "admin-card-wide"        // miniatura horizontal 3:1 em tabelas admin
  | "product-card"           // card de produto no portal (1:1)
  | "product-thumb";         // miniatura de produto em tabelas admin (1:1)

type ImageResizeMode = "cover" | "contain" | "fill";

type ImagePresetConfig = {
  width: number;
  height: number;
  quality: number;
  resize: ImageResizeMode;
};

const PRESETS: Record<ImagePreset, ImagePresetConfig> = {
  "cover-card-vertical":   { width: 400,  height: 533, quality: 80, resize: "cover" },
  "cover-card-horizontal": { width: 640,  height: 400, quality: 80, resize: "cover" },
  "cover-hero":            { width: 1280, height: 427, quality: 85, resize: "cover" },
  "lesson-card":           { width: 480,  height: 270, quality: 80, resize: "cover" },
  "lesson-thumb":          { width: 240,  height: 135, quality: 75, resize: "contain" },
  "admin-thumb":           { width: 100,  height: 100, quality: 75, resize: "cover" },
  "admin-card-sm":         { width: 120,  height: 160, quality: 75, resize: "cover" },
  "admin-card-wide":       { width: 360,  height: 120, quality: 75, resize: "cover" },
  "product-card":          { width: 400,  height: 400, quality: 80, resize: "cover" },
  "product-thumb":         { width: 160,  height: 160, quality: 75, resize: "cover" },
};

/** Extracts the `t` query-param value used as cache buster (e.g. ?t=1710000000) */
function extractCacheBuster(url: string): string | null {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return null;
  const params = new URLSearchParams(url.slice(qIndex));
  return params.get("t");
}

function resolveVersionToken(version?: string | number | null): string | null {
  if (version == null || version === "") return null;
  if (typeof version === "number") return String(version);
  const parsed = Date.parse(version);
  return Number.isNaN(parsed) ? version : String(parsed);
}

function appendCacheBuster(url: string, cacheBuster: string | null): string {
  if (!cacheBuster) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${encodeURIComponent(cacheBuster)}`;
}

/**
 * Converts a Supabase public storage URL to the image render endpoint
 * with the given dimensions and quality. CDN-cached after first render.
 * Returns original URL unchanged if it's not a Supabase /object/public/ URL.
 */
function toOptimizedUrl(
  url: string,
  width: number,
  height: number,
  quality = 80,
  resize: "cover" | "contain" | "fill" = "cover"
): string {
  const clean = url.split("?")[0];
  if (!clean.includes("/storage/v1/object/public/")) return url;

  // Preserve cache-buster (?t=...) so CDN serves fresh image after re-upload
  const cacheBuster = extractCacheBuster(url);

  return (
    clean.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
    `?width=${width}&height=${height}&resize=${resize}&quality=${quality}` +
    (cacheBuster ? `&t=${cacheBuster}` : "")
  );
}

// ---------------------------------------------------------------------------
// Public URL helpers (sem transformação — usar apenas em editores/preview)
// ---------------------------------------------------------------------------

/**
 * Returns the direct public URL for a file in the `covers` bucket.
 * No signed URL needed — bucket is public.
 * Use this only in editors where the original quality matters.
 */
export function cleanCoverValue(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  return normalizeCoversPath(pathOrUrl);
}

export function getCoversPublicUrl(
  pathOrUrl: string,
  version?: string | number | null
): string {
  const normalized = cleanCoverValue(pathOrUrl);
  if (!normalized) return "";
  const legacyCacheBuster = extractCacheBuster(pathOrUrl);
  const cacheBuster = resolveVersionToken(version) ?? legacyCacheBuster;

  if (normalized.startsWith("http")) {
    return appendCacheBuster(normalized, cacheBuster);
  }

  const { data } = supabase.storage.from("covers").getPublicUrl(normalized);
  return appendCacheBuster(data.publicUrl, cacheBuster);
}

// ---------------------------------------------------------------------------
// Optimized URL helpers (usar em listas, galerias, vitrines)
// ---------------------------------------------------------------------------

/**
 * Returns an optimized (resized + compressed) URL for a course cover.
 * Use this everywhere covers are displayed (lists, storefronts, cards).
 */
export function getCoversOptimizedUrl(
  pathOrUrl: string | null | undefined,
  preset: ImagePreset,
  version?: string | number | null
): string {
  if (!pathOrUrl) return "";
  const full = getCoversPublicUrl(pathOrUrl, version);
  if (!full) return "";
  const { width, height, quality, resize } = PRESETS[preset];
  return toOptimizedUrl(full, width, height, quality, resize);
}

/**
 * Lesson thumbnails now live in `covers`, but older rows can still carry:
 * - full Supabase public URLs
 * - legacy `assets` public URLs
 * - paths with cache-buster query params
 *
 * Returns original full URL — use only in editors.
 */
export function getLessonThumbnailUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  return getCoversPublicUrl(pathOrUrl);
}

/**
 * Returns an optimized lesson thumbnail.
 * Use "lesson-card" for course grids, "lesson-thumb" for sidebars.
 */
export function getLessonThumbnailOptimizedUrl(
  pathOrUrl: string | null | undefined,
  preset: "lesson-card" | "lesson-thumb" = "lesson-thumb"
): string {
  if (!pathOrUrl) return "";
  const cacheBuster = extractCacheBuster(pathOrUrl);
  const full = getCoversPublicUrl(pathOrUrl);
  if (!full) return "";
  const { width, height, quality, resize } = PRESETS[preset];
  const optimized = toOptimizedUrl(full, width, height, quality, resize);
  if (cacheBuster && !optimized.includes("&t=")) {
    return optimized + `&t=${cacheBuster}`;
  }
  return optimized;
}

/**
 * Returns an optimized URL for any arbitrary Supabase storage URL using a preset.
 * Useful for hero images stored outside the covers bucket (e.g. showcase bg_url).
 */
export function getOptimizedUrl(
  urlOrPath: string | null | undefined,
  preset: ImagePreset
): string {
  if (!urlOrPath) return "";
  if (!urlOrPath.startsWith("http")) return urlOrPath;
  const { width, height, quality, resize } = PRESETS[preset];
  return toOptimizedUrl(urlOrPath, width, height, quality, resize);
  // Cache buster preserved by toOptimizedUrl itself for direct URLs
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function normalizeLessonThumbnailPath(pathOrUrl: string): string {
  const raw = stripQueryAndHash(pathOrUrl.trim());
  if (!raw) return "";

  if (!raw.startsWith("http")) {
    return raw.replace(/^\/+/, "");
  }

  const parsed = parseSupabasePublicObject(raw);
  if (!parsed) return raw;

  // `assets` is accepted for legacy rows migrated to the same path in `covers`.
  if (parsed.bucket === "covers" || parsed.bucket === "assets") {
    return parsed.path;
  }

  return raw;
}

function normalizeCoversPath(pathOrUrl: string): string {
  const raw = stripQueryAndHash(pathOrUrl.trim());
  if (!raw) return "";

  if (!raw.startsWith("http")) {
    return raw.replace(/^\/+/, "");
  }

  const parsed = parseSupabasePublicObject(raw);
  if (parsed?.bucket === "covers") return parsed.path;
  return raw;
}

function stripQueryAndHash(value: string): string {
  const noHash = value.split("#", 1)[0];
  return noHash.split("?", 1)[0];
}

function parseSupabasePublicObject(url: string): { bucket: string; path: string } | null {
  const marker = "/storage/v1/object/public/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  const objectRef = url.slice(markerIndex + marker.length);
  const slashIndex = objectRef.indexOf("/");
  if (slashIndex === -1) return null;

  return {
    bucket: objectRef.slice(0, slashIndex),
    path: safeDecodeURIComponent(objectRef.slice(slashIndex + 1)),
  };
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
