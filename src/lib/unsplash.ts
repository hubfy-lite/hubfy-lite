const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
const BASE_URL = "https://api.unsplash.com";

export type UnsplashOrientation = "landscape" | "portrait" | "squarish";

export interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    links: { html: string };
  };
  links: {
    download_location: string;
  };
  alt_description: string | null;
  width: number;
  height: number;
}

export interface UnsplashSearchResult {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

const headers = {
  Authorization: `Client-ID ${ACCESS_KEY}`,
};

export async function searchPhotos(
  query: string,
  page = 1,
  perPage = 20,
  orientation?: UnsplashOrientation,
): Promise<UnsplashSearchResult> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
  });

  if (orientation) {
    params.set("orientation", orientation);
  }

  const res = await fetch(`${BASE_URL}/search/photos?${params}`, { headers });

  if (!res.ok) {
    throw new Error(`Unsplash API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Triggers the Unsplash download tracking (required by API guidelines)
 * and fetches the image as a Blob for re-upload to Supabase Storage.
 */
export async function downloadPhoto(photo: UnsplashPhoto): Promise<Blob> {
  // 1. Trigger download tracking (required by Unsplash)
  await fetch(photo.links.download_location, { headers });

  // 2. Fetch image blob from the regular URL (1080px width)
  const imageRes = await fetch(photo.urls.regular);

  if (!imageRes.ok) {
    throw new Error("Failed to download image");
  }

  return imageRes.blob();
}

export function isUnsplashConfigured(): boolean {
  return !!ACCESS_KEY;
}
