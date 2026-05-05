import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VideoSettings } from "@/lib/video-settings";

interface LessonVideo {
  thumbnail_url: string | null;
  status: string | null;
}

interface LessonAssetLink {
  id: string;
}

interface CourseLesson {
  id: string;
  public_id: string;
  title: string;
  sort_order: number | null;
  duration_seconds: number | null;
  is_active: boolean;
  thumbnail_url: string | null;
  // lesson_videos has UNIQUE on lesson_id → PostgREST returns object, not array
  lesson_videos: LessonVideo | null;
  lesson_assets_link: LessonAssetLink[];
}

interface CourseModule {
  id: string;
  public_id: string;
  title: string;
  sort_order: number | null;
  lessons: CourseLesson[];
}

export interface CourseShowcaseData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_horizontal_url: string | null;
  updated_at: string;
  tenant_id: string;
  tenants: {
    id: string;
    name: string;
    slug: string;
    tenant_settings: {
      plan: string | null;
      icon_url: string | null;
      icon_name: string | null;
      icon_color: string | null;
      primary_color: string | null;
      portal_button_style: string | null;
      social_links: Record<string, string> | null;
      video_settings: VideoSettings | null;
      video_protection_enabled: boolean | null;
      video_progress_tracking_enabled: boolean | null;
    } | null;
  };
  modules: CourseModule[];
}

export function useCourseByTenantAndSlug(
  tenantSlug: string | undefined,
  courseSlug: string | undefined
) {
  return useQuery({
    queryKey: ["course-showcase", tenantSlug, courseSlug],
    queryFn: async () => {
      if (!tenantSlug || !courseSlug) return null;

      const { data, error } = await supabase
        .from("courses")
        .select(`
          id, title, slug, description,
          cover_horizontal_url, updated_at,
          tenant_id,
          tenants!inner(id, name, slug, tenant_settings(plan, icon_url, icon_name, icon_color, primary_color, portal_button_style, social_links, video_settings, video_protection_enabled, video_progress_tracking_enabled)),
          modules(
            id, public_id, title, sort_order,
            lessons(
              id, public_id, title, sort_order, duration_seconds, is_active, thumbnail_url,
              lesson_videos(thumbnail_url, status),
              lesson_assets_link(id)
            )
          )
        `)
        .eq("tenants.slug", tenantSlug)
        .eq("slug", courseSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown) as CourseShowcaseData | null;
    },
    enabled: !!tenantSlug && !!courseSlug,
  });
}
