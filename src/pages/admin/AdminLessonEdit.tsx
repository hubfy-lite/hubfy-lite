import { useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "@/hooks/usePageTitle";
import { withAppBrand } from "@/lib/page-title";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLessonEditor } from "@/hooks/useLessonEditor";
import { LessonGeneralSection } from "@/components/admin/lesson-edit/LessonGeneralSection";
import { LessonVideoSection } from "@/components/admin/lesson-edit/LessonVideoSection";
import { LessonFilesSection } from "@/components/admin/lesson-edit/LessonFilesSection";
import { LessonLinksSection } from "@/components/admin/lesson-edit/LessonLinksSection";

// Lazy load TipTap editor (heaviest dependency)
const LessonBlocksSection = lazy(() =>
  import("@/components/admin/lesson-edit/LessonBlocksSection").then((m) => ({
    default: m.LessonBlocksSection,
  }))
);

// ── Tab routing ────────────────────────────────────────────────────

type Tab = "general" | "video" | "files" | "links" | "blocks";

const VALID_TABS: Tab[] = ["general", "video", "files", "links", "blocks"];
const DEFAULT_TAB: Tab = "general";

function isValidTab(value: string | null): value is Tab {
  return VALID_TABS.includes(value as Tab);
}

// ── Component ──────────────────────────────────────────────────────

export default function AdminLessonEdit() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const activeTab: Tab = isValidTab(rawTab) ? rawTab : DEFAULT_TAB;

  // Sync invalid/missing tab to URL
  useEffect(() => {
    if (rawTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [rawTab, activeTab, setSearchParams]);

  const handleTabChange = (tab: Tab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const sections: { id: Tab; label: string }[] = [
    { id: "general", label: t("lessonEdit.sections.general") },
    { id: "video", label: t("lessonEdit.sections.video") },
    { id: "files", label: t("lessonEdit.sections.files") },
    { id: "links", label: t("lessonEdit.sections.links") },
    { id: "blocks", label: t("lessonEdit.sections.blocks") },
  ];

  // Fetch course slug for preview link
  const { data: courseSlug } = useQuery({
    queryKey: ["course-slug", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("slug")
        .eq("public_id", courseId!)
        .single();
      return data?.slug ?? null;
    },
    enabled: !!courseId,
    staleTime: Infinity,
  });

  // Editor hook
  const {
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
  } = useLessonEditor(lessonId);

  usePageTitle(useMemo(() => saved ? withAppBrand(t("lessonEdit.lessonLabel", "Aula"), saved.lesson.title) : null, [saved, t]));

  const goBack = useCallback(
    () => navigate(`/admin/courses/${courseId}`),
    [navigate, courseId]
  );

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleSave = async () => {
    await save();
  };

  const handleCancel = () => {
    reset();
    goBack();
  };

  // ── Error state ───────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">
          {t("lessonEdit.loadError")}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goBack}>
            {t("common.back")}
          </Button>
          <Button onClick={() => refetch()}>
            {t("common.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────

  if (isLoading || !draft) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon-sm" onClick={handleCancel}>
            <X className="size-4" />
          </Button>
          <span className="text-base font-semibold truncate">
            {saved?.lesson.title || t("lessonEdit.title")}
          </span>
        </div>

        <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => handleTabChange(section.id)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === section.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 flex justify-end">
          {tenant?.slug && courseSlug && lessonId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/${tenant.slug}/${courseSlug}/${lessonId}`, "_blank")}
            >
              <Eye className="size-4" />
              Ver preview
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        <div
          className={cn(
            "max-w-[1200px] 3xl:max-w-[1600px] mx-auto w-full",
            activeTab === "blocks" || activeTab === "video" ? "flex flex-col flex-1" : ""
          )}
        >
          {activeTab === "general" && lessonId && tenant && (
            <LessonGeneralSection
              lessonId={lessonId}
              tenantId={tenant.id}
              title={draft.title}
              onTitleChange={(v) => updateDraft({ title: v })}
              description={draft.description ?? ""}
              onDescriptionChange={(v) => updateDraft({ description: v || null })}
              thumbnailUrl={draft.thumbnailPath || ""}
              onThumbnailUrlChange={(v) => updateDraft({ thumbnailPath: v || null })}
            />
          )}

          {activeTab === "video" && lessonId && tenant && (
            <LessonVideoSection
              tenantId={tenant.id}
              selectedVideoAssetId={draft.selectedVideoAssetId}
              videoProvider={draft.videoProvider}
              videoProviderAssetId={draft.videoProviderAssetId}
              videoPlaybackUrl={draft.videoPlaybackUrl}
              videoThumbnailUrl={draft.videoThumbnailUrl}
              videoDuration={draft.videoDuration}
              videoPayload={draft.videoPayload}
              onVideoSelect={(assetId) =>
                updateDraft({
                  selectedVideoAssetId: assetId,
                  videoProvider: null,
                  videoProviderAssetId: null,
                  videoPlaybackUrl: null,
                  videoThumbnailUrl: null,
                  videoDuration: null,
                  videoPayload: null,
                })
              }
              onVideoRemove={() =>
                updateDraft({
                  selectedVideoAssetId: null,
                  videoProvider: null,
                  videoProviderAssetId: null,
                  videoPlaybackUrl: null,
                  videoThumbnailUrl: null,
                  videoDuration: null,
                  videoPayload: null,
                })
              }
              onExternalVideoChange={(provider, data) =>
                updateDraft({
                  videoProvider: provider,
                  videoProviderAssetId: data?.providerAssetId ?? null,
                  videoPlaybackUrl: data?.playbackUrl ?? null,
                  videoThumbnailUrl: data?.thumbnailUrl ?? null,
                  videoDuration: data?.duration ?? null,
                  videoPayload: data?.payload ?? null,
                  selectedVideoAssetId: null,
                })
              }
            />
          )}

          {activeTab === "files" && lessonId && tenant && (
            <LessonFilesSection
              tenantId={tenant.id}
              linkedAssetIds={draft.linkedAssetIds}
              onLinkedAssetIdsChange={(ids) =>
                updateDraft({ linkedAssetIds: ids })
              }
            />
          )}

          {activeTab === "links" && (
            <LessonLinksSection
              links={draft.links}
              onLinksChange={(links) => updateDraft({ links })}
            />
          )}

          {activeTab === "blocks" && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <LessonBlocksSection
                contentHtml={draft.contentHtml || ""}
                customHtml={draft.customHtml || ""}
                contentMode={draft.contentMode}
                onContentHtmlChange={(v) => updateDraft({ contentHtml: v || null })}
                onCustomHtmlChange={(v) => updateDraft({ customHtml: v || null })}
                onContentModeChange={(mode) => updateDraft({ contentMode: mode })}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border shrink-0 bg-background">
        <div className="max-w-[1200px] 3xl:max-w-[1600px] mx-auto flex items-center justify-end gap-3 px-6 py-4">
          <Button variant="outline" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !isDirty}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
