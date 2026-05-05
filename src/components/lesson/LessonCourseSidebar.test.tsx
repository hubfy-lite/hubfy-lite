import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@/lib/storage-urls", () => ({
  getLessonThumbnailOptimizedUrl: vi.fn(() => "https://cdn.example.com/thumb.webp"),
}));

import { LessonCourseSidebar } from "@/components/lesson/LessonCourseSidebar";
import type { CourseShowcaseData } from "@/hooks/useCourseByTenantAndSlug";

describe("LessonCourseSidebar", () => {
  it("renders lesson thumbnails without object-cover cropping", () => {
    const course: CourseShowcaseData = {
      id: "course-1",
      title: "Agente Lucrativo",
      slug: "agente-lucrativo",
      description: null,
      cover_horizontal_url: null,
      updated_at: "2026-03-31T00:00:00.000Z",
      tenant_id: "tenant-1",
      tenants: {
        id: "tenant-1",
        name: "Hubfy",
        slug: "tenant",
        tenant_settings: null,
      },
      modules: [
        {
          id: "module-1",
          public_id: "module-public-1",
          title: "Comece aqui",
          sort_order: 0,
          lessons: [
            {
              id: "lesson-1",
              public_id: "lesson-public-1",
              title: "Comece por aqui",
              is_active: true,
              sort_order: 0,
              thumbnail_url: "tenant/demo/lessons/lesson-1/thumbnail.jpg",
              duration_seconds: 120,
              lesson_videos: null,
              lesson_assets_link: [],
            },
          ],
        },
      ],
    };

    render(
      <MemoryRouter>
        <LessonCourseSidebar
          course={course}
          currentLessonId="lesson-public-1"
          tenantSlug="tenant"
          courseSlug="agente-lucrativo"
        />
      </MemoryRouter>,
    );

    const image = screen.getByAltText("Comece por aqui");
    expect(image).toHaveClass("object-contain");
    expect(image).not.toHaveClass("object-cover");
  });
});
