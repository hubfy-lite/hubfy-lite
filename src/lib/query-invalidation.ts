import type { QueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Centralised query invalidation helpers
// ---------------------------------------------------------------------------
// When visual data changes (covers, colors, avatars, backgrounds, thumbnails),
// every view that renders that data must be told to refetch.
//
// Instead of each hook knowing all the query keys in the app, we provide
// topic-based helpers that invalidate all related queries in one call.
// If a new portal/showcase query is added in the future, update HERE only.
// ---------------------------------------------------------------------------

/**
 * Invalidate all portal-facing product queries.
 * Call after any product mutation (create/update/delete) that changes data
 * visible in the portal: covers, names, status, etc.
 */
export function invalidatePortalProducts(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["portal-products-hero"] });
  qc.invalidateQueries({ queryKey: ["portal-purchased-products"] });
  qc.invalidateQueries({ queryKey: ["portal-product-detail-access"] });
}

/**
 * Invalidate all showcase queries (admin list + public pages).
 * Call after any showcase mutation that changes visual data:
 * hero_url, bg_url, bg_dark_url, bg_light_url, logo_url, cover_format, etc.
 */
export function invalidateShowcases(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["showcases"] });
  qc.invalidateQueries({ queryKey: ["club-showcase"] });
  qc.invalidateQueries({ queryKey: ["course-showcase"] });
}

/**
 * Invalidate all lesson-related queries.
 * Call after lesson mutations that change thumbnails or content.
 */
export function invalidateLessons(qc: QueryClient, lessonId?: string) {
  if (lessonId) {
    qc.invalidateQueries({ queryKey: ["lesson-editor", lessonId] });
    qc.invalidateQueries({ queryKey: ["lesson-detail", lessonId] });
  } else {
    qc.invalidateQueries({ queryKey: ["lesson-editor"] });
    qc.invalidateQueries({ queryKey: ["lesson-detail"] });
  }
}

/**
 * Invalidate course queries (admin list + public course page).
 * Call after any course mutation that changes visual data: covers, title, etc.
 */
export function invalidateCourses(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["courses"] });
  invalidateShowcases(qc);
}

/**
 * Invalidate workspace/tenant visual data (icon, color, name).
 * Ensures sidebar, workspace switcher, and portal all update.
 */
export function invalidateTenantVisuals(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["user-workspaces"] });
  qc.invalidateQueries({ queryKey: ["portal-tenant-footer"] });
}
