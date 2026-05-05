import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLessonThumbnailPath } from "@/lib/storage-urls";
import { invalidateLessons } from "@/lib/query-invalidation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// ── Types ──────────────────────────────────────────────────────────

export interface LessonEditorLink {
  label: string;
  url: string;
  displayUrl: string;
}

export interface LessonEditorDraft {
  title: string;
  description: string | null;
  thumbnailPath: string | null;
  contentHtml: string | null;       // rich editor output (TipTap)
  customHtml: string | null;        // raw HTML editor content
  contentMode: "rich" | "html";     // which of the two is rendered to students
  linkedAssetIds: string[];
  links: LessonEditorLink[];
  // Video — unified via lesson_videos
  selectedVideoAssetId: string | null; // Gumlet (asset library path)
  videoProvider: string | null; // 'gumlet' | 'vimeo' | 'youtube' | null
  videoProviderAssetId: string | null; // ID in the provider
  videoPlaybackUrl: string | null; // embed URL
  videoThumbnailUrl: string | null;
  videoDuration: number | null;
  videoPayload: Record<string, unknown> | null; // provider_payload
}

interface SavedLessonData {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  content: string | null;
  custom_html: string | null;
  content_mode: string;
  is_active: boolean;
}

interface SavedVideoData {
  provider: string;
  provider_asset_id: string | null;
  playback_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  provider_payload: Record<string, unknown> | null;
  asset_id: string | null; // resolved from asset_videos join (Gumlet only)
}

interface SavedFileLink {
  asset_id: string;
  sort_order: number;
  label: string | null;
}

interface SavedLink {
  label: string;
  url: string;
  displayUrl: string;
  sort_order: number;
}

interface LessonEditorSaved {
  lesson: SavedLessonData;
  video: SavedVideoData | null;
  fileLinks: SavedFileLink[];
  links: SavedLink[];
}

// ── localStorage draft persistence ──────────────────────────────────
//
// Drafts live in localStorage while the author is editing so that an
// accidental refresh (or navigation to another tab and back) does not
// blow away unsaved work. The entry is cleared once `save()` succeeds
// or `reset()` is called.
//
// Key is scoped by lesson public_id so editing multiple lessons in
// separate tabs does not collide.

const DRAFT_STORAGE_PREFIX = "hubfy.lesson-draft.";

function draftStorageKey(lessonPublicId: string | undefined): string | null {
  if (!lessonPublicId) return null;
  return `${DRAFT_STORAGE_PREFIX}${lessonPublicId}`;
}

function readLocalDraft(lessonPublicId: string | undefined): LessonEditorDraft | null {
  const key = draftStorageKey(lessonPublicId);
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as LessonEditorDraft;
  } catch {
    return null;
  }
}

function writeLocalDraft(lessonPublicId: string | undefined, draft: LessonEditorDraft): void {
  const key = draftStorageKey(lessonPublicId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Quota errors or private mode: silently skip.
  }
}

function clearLocalDraft(lessonPublicId: string | undefined): void {
  const key = draftStorageKey(lessonPublicId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}

// ── Fetch function ─────────────────────────────────────────────────

async function fetchLessonEditorData(lessonPublicId: string): Promise<LessonEditorSaved> {
  // Fetch lesson by public_id (route param)
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, description, thumbnail_url, content, custom_html, content_mode, is_active")
    .eq("public_id", lessonPublicId)
    .single();

  if (lessonError || !lesson) {
    throw new Error("Lesson not found");
  }

  // Fetch video from lesson_videos (canonical source) — use resolved UUID
  const lessonUuid = lesson.id;
  const { data: videoRow } = await supabase
    .from("lesson_videos")
    .select("provider, provider_asset_id, playback_url, thumbnail_url, duration_seconds, provider_payload")
    .eq("lesson_id", lessonUuid)
    .maybeSingle();

  let video: SavedVideoData | null = null;

  if (videoRow) {
    let assetId: string | null = null;

    // For Gumlet: resolve asset_id from asset_videos (needed for library selection)
    if (videoRow.provider === "gumlet" && videoRow.provider_asset_id) {
      const { data: assetVideo } = await supabase
        .from("asset_videos")
        .select("asset_id")
        .eq("gumlet_asset_id", videoRow.provider_asset_id)
        .maybeSingle();
      assetId = assetVideo?.asset_id ?? null;
    }

    video = {
      provider: videoRow.provider,
      provider_asset_id: videoRow.provider_asset_id,
      playback_url: videoRow.playback_url,
      thumbnail_url: videoRow.thumbnail_url,
      duration_seconds: videoRow.duration_seconds,
      provider_payload: videoRow.provider_payload as Record<string, unknown> | null,
      asset_id: assetId,
    };
  }

  // Fetch file links
  const { data: fileLinksData } = await supabase
    .from("lesson_assets_link")
    .select("asset_id, sort_order, label")
    .eq("lesson_id", lessonUuid)
    .order("sort_order", { ascending: true });

  // Fetch external links (lesson_blocks type='link')
  const { data: linkBlocks } = await supabase
    .from("lesson_blocks")
    .select("payload, sort_order")
    .eq("lesson_id", lessonUuid)
    .eq("type", "link")
    .order("sort_order", { ascending: true });

  const savedLinks: SavedLink[] = (linkBlocks ?? []).map((b) => ({
    label: (b.payload as Record<string, string>)?.label ?? "",
    url: (b.payload as Record<string, string>)?.url ?? "",
    displayUrl: (b.payload as Record<string, string>)?.display_url ?? "",
    sort_order: b.sort_order,
  }));

  return {
    lesson,
    video,
    fileLinks: fileLinksData ?? [],
    links: savedLinks,
  };
}

// ── Hook ───────────────────────────────────────────────────────────

export function useLessonEditor(lessonId: string | undefined) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // React Query for server data
  const {
    data: saved,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["lesson-editor", lessonId],
    queryFn: () => fetchLessonEditorData(lessonId!),
    enabled: !!lessonId,
    staleTime: Infinity, // Don't refetch while editing
  });

  // Draft state
  const [draft, setDraftState] = useState<LessonEditorDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // Derive "saved" draft from server data (source of truth for isDirty)
  const savedDraft = useMemo<LessonEditorDraft | null>(() => {
    if (!saved) return null;
    return {
      title: saved.lesson.title,
      description: saved.lesson.description,
      thumbnailPath: saved.lesson.thumbnail_url,
      contentHtml: saved.lesson.content,
      customHtml: saved.lesson.custom_html,
      contentMode: (saved.lesson.content_mode === "html" ? "html" : "rich"),
      linkedAssetIds: saved.fileLinks.map((l) => l.asset_id),
      links: saved.links.map(({ label, url, displayUrl }) => ({ label, url, displayUrl })),
      selectedVideoAssetId: saved.video?.asset_id ?? null,
      videoProvider: saved.video?.provider ?? null,
      videoProviderAssetId: saved.video?.provider_asset_id ?? null,
      videoPlaybackUrl: saved.video?.playback_url ?? null,
      videoThumbnailUrl: saved.video?.thumbnail_url ?? null,
      videoDuration: saved.video?.duration_seconds ?? null,
      videoPayload: saved.video?.provider_payload ?? null,
    };
  }, [saved]);

  // Initialize draft from saved data or from localStorage — explicitly
  // bound to lessonId. localStorage wins so unsaved work survives refresh.
  const initializedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!savedDraft || initializedForRef.current === lessonId) return;

    const local = readLocalDraft(lessonId);
    setDraftState(local ?? { ...savedDraft });
    initializedForRef.current = lessonId ?? null;
  }, [savedDraft, lessonId]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!draft || !savedDraft) return false;
    return (
      draft.title !== savedDraft.title ||
      draft.description !== savedDraft.description ||
      draft.thumbnailPath !== savedDraft.thumbnailPath ||
      draft.contentHtml !== savedDraft.contentHtml ||
      draft.customHtml !== savedDraft.customHtml ||
      draft.contentMode !== savedDraft.contentMode ||
      draft.selectedVideoAssetId !== savedDraft.selectedVideoAssetId ||
      draft.videoProvider !== savedDraft.videoProvider ||
      draft.videoProviderAssetId !== savedDraft.videoProviderAssetId ||
      draft.videoPlaybackUrl !== savedDraft.videoPlaybackUrl ||
      draft.videoThumbnailUrl !== savedDraft.videoThumbnailUrl ||
      draft.videoDuration !== savedDraft.videoDuration ||
      JSON.stringify(draft.videoPayload) !== JSON.stringify(savedDraft.videoPayload) ||
      JSON.stringify(draft.linkedAssetIds) !== JSON.stringify(savedDraft.linkedAssetIds) ||
      JSON.stringify(draft.links) !== JSON.stringify(savedDraft.links)
    );
  }, [draft, savedDraft]);

  // Update draft (partial merge) — also mirrors to localStorage so
  // unsaved edits survive a refresh / tab reopen.
  const updateDraft = useCallback(
    (partial: Partial<LessonEditorDraft>) => {
      setDraftState((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...partial };
        writeLocalDraft(lessonId, next);
        return next;
      });
    },
    [lessonId]
  );

  // Reset draft to saved state and drop any local draft.
  const reset = useCallback(() => {
    if (savedDraft) {
      setDraftState({ ...savedDraft });
      clearLocalDraft(lessonId);
    }
  }, [savedDraft, lessonId]);

  // Save via RPC — uses the resolved UUID from server data, not the route param
  const save = useCallback(async () => {
    const resolvedId = saved?.lesson?.id;
    if (!resolvedId || !draft) return false;

    if (!draft.title.trim()) {
      toast.error(t("lessonEdit.titleRequired"));
      return false;
    }

    setSaving(true);

    const normalizedThumbnail = normalizeLessonThumbnailPath(draft.thumbnailPath || "");

    const { error: rpcError } = await supabase.rpc("save_lesson_editor", {
      p_lesson_id: resolvedId,
      p_title: draft.title,
      p_description: draft.description || null,
      p_thumbnail_path: normalizedThumbnail || null,
      p_content_html: draft.contentHtml || null,
      p_custom_html: draft.customHtml || null,
      p_content_mode: draft.contentMode,
      // Gumlet path: pass asset_id (resolves internally via asset_videos)
      p_video_asset_id: draft.videoProvider === "gumlet" || !draft.videoProvider
        ? draft.selectedVideoAssetId || null
        : null,
      // External provider path: pass video data directly
      p_video_provider: draft.videoProvider !== "gumlet" ? draft.videoProvider || null : null,
      p_video_provider_asset_id: draft.videoProvider !== "gumlet" ? draft.videoProviderAssetId || null : null,
      p_video_playback_url: draft.videoProvider !== "gumlet" ? draft.videoPlaybackUrl || null : null,
      p_video_thumbnail_url: draft.videoProvider !== "gumlet" ? draft.videoThumbnailUrl || null : null,
      p_video_duration: draft.videoProvider !== "gumlet" ? draft.videoDuration || null : null,
      p_video_payload: draft.videoProvider !== "gumlet" ? draft.videoPayload || null : null,
      p_linked_asset_ids: draft.linkedAssetIds,
      p_links: draft.links
        .filter((l) => l.url.trim())
        .map((l) => ({
          label: l.label.trim(),
          url: /^https?:\/\//i.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}`,
          display_url: l.displayUrl.trim(),
        })),
    });

    if (rpcError) {
      console.error("Save error:", rpcError);
      toast.error(t("lessonEdit.saveError"));
      setSaving(false);
      return false;
    }

    toast.success(t("lessonEdit.saved"));

    // Drop the local draft now that the server has the canonical version.
    clearLocalDraft(lessonId);

    // Invalidate to get fresh data (editor + detail view + any course grids)
    // Use public_id (route param) to match the query key, plus UUID for detail view
    await invalidateLessons(queryClient, lessonId);
    await invalidateLessons(queryClient, resolvedId);
    // Reset ref so re-init picks up fresh data when query resolves
    initializedForRef.current = null;

    setSaving(false);
    return true;
  }, [saved?.lesson?.id, draft, t, queryClient, lessonId]);

  return {
    draft,
    saved,
    isLoading,
    error,
    isDirty,
    saving,
    updateDraft,
    reset,
    save,
    refetch,
  };
}
