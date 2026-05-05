import { describe, it, expect } from "vitest";

/**
 * Tests the asset_files normalisation logic used in useLesson.
 *
 * PostgREST returns asset_files as a single object (one-to-one FK)
 * but older Supabase versions may return an array.  The normaliser
 * must handle both shapes identically.
 */

// Extracted normalisation helper (mirrors useLesson.ts logic)
function normaliseAssetFile(raw: unknown): Record<string, string> | null {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw as Record<string, string>) ?? null;
}

const sampleFile = {
  bucket: "assets",
  object_path: "files/doc.pdf",
  original_filename: "doc.pdf",
};

describe("asset_files normalisation", () => {
  it("handles asset_files as a single object (PostgREST one-to-one)", () => {
    expect(normaliseAssetFile(sampleFile)).toEqual(sampleFile);
  });

  it("handles asset_files as an array (legacy/edge case)", () => {
    expect(normaliseAssetFile([sampleFile])).toEqual(sampleFile);
  });

  it("returns null for empty array", () => {
    expect(normaliseAssetFile([])).toBeNull();
  });

  it("returns null for null", () => {
    expect(normaliseAssetFile(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normaliseAssetFile(undefined)).toBeNull();
  });
});
