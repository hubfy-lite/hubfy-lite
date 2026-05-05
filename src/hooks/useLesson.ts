import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LessonVideoDetail {
  id: string;
  provider: string;
  provider_asset_id: string | null;
  playback_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  status: string | null;
  provider_payload: Record<string, unknown> | null;
}

export type AssetStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted';

export interface LessonFileAsset {
  id: string;
  label: string | null;
  sort_order: number;
  asset: {
    id: string;
    title: string;
    mime_type: string | null;
    size_bytes: number | null;
    status: AssetStatus;
    file: {
      bucket: string;
      object_path: string;
      original_filename: string;
    } | null;
  } | null;
}

export interface LessonLinkItem {
  label: string;
  url: string;
  displayUrl: string;
  sort_order: number;
}

export interface LessonDetail {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  content: string | null;       // rich editor output (TipTap)
  customHtml: string | null;    // raw HTML content (author-pasted)
  contentMode: "rich" | "html"; // which of the two is rendered
  thumbnail_url: string | null;
  duration_seconds: number | null;
  module_id: string;
  video: LessonVideoDetail | null;
  files: LessonFileAsset[];
  links: LessonLinkItem[];
}

export function useLesson(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["lesson-detail", lessonId],
    queryFn: async () => {
      if (!lessonId) return null;

      const { data, error } = await supabase
        .from("lessons")
        .select(`
          id, public_id, title, description, content, custom_html, content_mode, thumbnail_url, duration_seconds,
          module_id,
          lesson_videos(id, provider, provider_asset_id, playback_url, thumbnail_url, duration_seconds, status, provider_payload),
          lesson_assets_link(
            id, label, sort_order, asset_id,
            assets(id, title, mime_type, size_bytes, status,
              asset_files(bucket, object_path, original_filename)
            )
          )
        `)
        .eq("public_id", lessonId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Fetch external links (lesson_blocks type='link') — separate query
      // because lesson_blocks is not joinable via PostgREST embed on public_id filter
      const { data: linkBlocks } = await supabase
        .from("lesson_blocks")
        .select("payload, sort_order")
        .eq("lesson_id", data.id)
        .eq("type", "link")
        .order("sort_order", { ascending: true });

      const links: LessonLinkItem[] = (linkBlocks ?? []).map((b) => ({
        label: (b.payload as Record<string, string>)?.label ?? "",
        url: (b.payload as Record<string, string>)?.url ?? "",
        displayUrl: (b.payload as Record<string, string>)?.display_url ?? "",
        sort_order: b.sort_order,
      }));

      // lesson_videos has a UNIQUE constraint on lesson_id, so PostgREST
      // returns a single object (not an array). Handle both just in case.
      const videoRaw = data.lesson_videos as unknown as LessonVideoDetail | LessonVideoDetail[] | null;
      const video = Array.isArray(videoRaw) ? (videoRaw[0] ?? null) : (videoRaw ?? null);

      const files: LessonFileAsset[] = [...(data.lesson_assets_link || [])]
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
        .map((link) => {
          const asset = link.assets as any;
          const assetFile = Array.isArray(asset?.asset_files)
            ? asset.asset_files[0] ?? null
            : asset?.asset_files ?? null;
          return {
            id: link.id,
            label: link.label,
            sort_order: link.sort_order,
            asset: asset
              ? {
                  id: asset.id,
                  title: asset.title,
                  mime_type: asset.mime_type,
                  size_bytes: asset.size_bytes,
                  status: asset.status ?? 'ready',
                  file: assetFile,
                }
              : null,
          };
        });

      return {
        id: data.id,
        public_id: data.public_id,
        title: data.title,
        description: data.description,
        content: data.content,
        customHtml: data.custom_html,
        contentMode: (data.content_mode === "html" ? "html" : "rich") as "rich" | "html",
        thumbnail_url: data.thumbnail_url,
        duration_seconds: data.duration_seconds,
        module_id: data.module_id,
        video: video
          ? {
              id: video.id,
              provider: video.provider,
              provider_asset_id: video.provider_asset_id,
              playback_url: video.playback_url,
              thumbnail_url: video.thumbnail_url,
              duration_seconds: video.duration_seconds,
              status: video.status,
              provider_payload: video.provider_payload,
            }
          : null,
        files,
        links,
      } as LessonDetail;
    },
    enabled: !!lessonId,
    // Keep previous lesson data while fetching the new one
    // → avoids full-page flash on lesson switch
    placeholderData: keepPreviousData,
  });
}
