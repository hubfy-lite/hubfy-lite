import { BRAND_NAME } from "@/lib/brand";

export { BRAND_NAME as APP_BRAND_NAME };

export function joinTitleSegments(...segments: Array<string | null | undefined>) {
  return segments
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment))
    .join(" | ");
}

export function withAppBrand(...segments: Array<string | null | undefined>) {
  const title = joinTitleSegments(...segments);
  if (!title) return BRAND_NAME;
  return title === BRAND_NAME ? BRAND_NAME : joinTitleSegments(title, BRAND_NAME);
}
