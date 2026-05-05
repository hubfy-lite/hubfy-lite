import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/covers/${path}`,
          },
        })),
      })),
    },
  },
}));

import { getLessonThumbnailOptimizedUrl } from "@/lib/storage-urls";

describe("getLessonThumbnailOptimizedUrl", () => {
  it("uses contain resize for lesson sidebar thumbnails", () => {
    const url = getLessonThumbnailOptimizedUrl(
      "tenant/demo/lessons/lesson-1/thumbnail.jpg?t=1710000000",
      "lesson-thumb",
    );

    expect(url).toContain("width=240");
    expect(url).toContain("height=135");
    expect(url).toContain("resize=contain");
    expect(url).toContain("quality=75");
    expect(url).toContain("t=1710000000");
  });

  it("keeps cover resize for lesson cards", () => {
    const url = getLessonThumbnailOptimizedUrl(
      "tenant/demo/lessons/lesson-1/thumbnail.jpg",
      "lesson-card",
    );

    expect(url).toContain("width=480");
    expect(url).toContain("height=270");
    expect(url).toContain("resize=cover");
    expect(url).toContain("quality=80");
  });
});
