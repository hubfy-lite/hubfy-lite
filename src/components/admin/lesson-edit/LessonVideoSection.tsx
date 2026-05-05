import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Video, X, Loader2, Search, Play, Check, Youtube, AlertCircle, ExternalLink, Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  buildYouTubeEmbedUrl,
} from "@/lib/youtube-utils";
import {
  extractSmartPlayerVideoId,
  buildSmartPlayerEmbedUrl,
} from "@/lib/smartplayer-utils";
import { useVimeoIntegration, useVimeoVideos, type VimeoVideoItem } from "@/hooks/useVimeoIntegration";
import { useSimpleIntegration } from "@/hooks/useSimpleIntegration";
import { usePandaVideoVideos, type PandaVideoItem } from "@/hooks/usePandaVideoVideos";
import { useWistiaVideos, type WistiaVideoItem } from "@/hooks/useWistiaVideos";
import { useLessonVideoAssets, usePinnedAsset, usePrefillPinnedAsset, type AssetWithVideo } from "@/hooks/useLessonVideoAssets";

// Lazy load video player modal (only needed on preview)
const VideoPlayerModal = lazy(() =>
  import("../VideoPlayerModal").then((m) => ({ default: m.VideoPlayerModal }))
);

type VideoSubTab = "library" | "youtube" | "vimeo" | "smartplayer" | "pandavideo" | "wistia";

interface ExternalVideoData {
  providerAssetId: string;
  playbackUrl: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  payload?: Record<string, unknown> | null;
}

interface LessonVideoSectionProps {
  tenantId: string;
  selectedVideoAssetId: string | null;
  videoProvider: string | null;
  videoProviderAssetId: string | null;
  videoPlaybackUrl: string | null;
  videoThumbnailUrl: string | null;
  videoDuration: number | null;
  videoPayload: Record<string, unknown> | null;
  onVideoSelect: (assetId: string) => void;
  onVideoRemove: () => void;
  onExternalVideoChange: (provider: string | null, data: ExternalVideoData | null) => void;
}

export function LessonVideoSection({
  tenantId,
  selectedVideoAssetId,
  videoProvider,
  videoProviderAssetId,
  videoPlaybackUrl,
  videoThumbnailUrl,
  videoDuration,
  videoPayload,
  onVideoSelect,
  onVideoRemove,
  onExternalVideoChange,
}: LessonVideoSectionProps) {
  const { t } = useTranslation();
  const { tenant } = useTenant();

  // Derive active sub-tab from video state
  const derivedSubTab: VideoSubTab =
    videoProvider === "youtube" ? "youtube"
    : videoProvider === "vimeo" ? "vimeo"
    : videoProvider === "smartplayer" ? "smartplayer"
    : videoProvider === "pandavideo" ? "pandavideo"
    : videoProvider === "wistia" ? "wistia"
    : "library";
  const [activeSubTab, setActiveSubTab] = useState<VideoSubTab>(derivedSubTab);

  // Keep sub-tab in sync when external data changes (e.g., on initial load)
  useEffect(() => {
    setActiveSubTab(derivedSubTab);
  }, [derivedSubTab]);

  // YouTube local state
  const youtubeSourceUrl = videoProvider === "youtube" ? (videoPayload?.source_url as string) ?? videoPlaybackUrl : null;
  const [youtubeInput, setYoutubeInput] = useState(youtubeSourceUrl ?? "");
  const [youtubeTouched, setYoutubeTouched] = useState(false);

  useEffect(() => {
    setYoutubeInput(youtubeSourceUrl ?? "");
    setYoutubeTouched(false);
  }, [youtubeSourceUrl]);

  // Smart Player local state
  const smartplayerSourceUrl = videoProvider === "smartplayer" ? (videoPayload?.source_url as string) ?? videoPlaybackUrl : null;
  const [smartplayerInput, setSmartplayerInput] = useState(smartplayerSourceUrl ?? "");
  const [smartplayerTouched, setSmartplayerTouched] = useState(false);

  useEffect(() => {
    setSmartplayerInput(smartplayerSourceUrl ?? "");
    setSmartplayerTouched(false);
  }, [smartplayerSourceUrl]);

  // ── Library: React Query hooks ──────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    assets: availableAssets,
    isLoading: loadingAssets,
    fetchNextPage: fetchNextLibraryPage,
    hasNextPage: hasMoreLibrary,
    isFetchingNextPage: loadingMoreLibrary,
  } = useLessonVideoAssets(tenantId, debouncedSearch);

  const { data: pinnedAsset } = usePinnedAsset(selectedVideoAssetId);
  const prefillPinnedAsset = usePrefillPinnedAsset();

  // Preview state (for video player modal)
  const [previewGumletId, setPreviewGumletId] = useState<string | null>(null);
  const [previewEmbedUrl, setPreviewEmbedUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const openLibraryPreview = (asset: AssetWithVideo) => {
    setPreviewGumletId(asset.asset_videos?.gumlet_asset_id ?? null);
    setPreviewEmbedUrl(null);
    setPreviewTitle(asset.title ?? t("lessonEdit.sections.video"));
  };

  const openVimeoPreview = () => {
    if (!videoPlaybackUrl) return;
    setPreviewGumletId(null);
    setPreviewEmbedUrl(videoPlaybackUrl);
    setPreviewTitle((videoPayload?.title as string) || `Vimeo ${videoProviderAssetId}`);
  };

  const closePreview = () => {
    setPreviewGumletId(null);
    setPreviewEmbedUrl(null);
    setPreviewTitle("");
  };

  const isPreviewOpen = !!(previewGumletId || previewEmbedUrl);

  // Handle scroll for infinite loading (Library)
  const handleLibraryScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMoreLibrary || !hasMoreLibrary) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchNextLibraryPage();
    }
  }, [loadingMoreLibrary, hasMoreLibrary, fetchNextLibraryPage]);

  // YouTube handlers
  const youtubeVideoId = extractYouTubeVideoId(youtubeInput);
  const isYoutubeValid = youtubeInput.trim() === "" || youtubeVideoId !== null;
  const hasYoutubeVideo = videoProvider === "youtube" && videoProviderAssetId;
  const savedYoutubeId = videoProviderAssetId && videoProvider === "youtube" ? videoProviderAssetId : null;

  const handleYoutubeConfirm = () => {
    if (!youtubeVideoId) return;
    onExternalVideoChange("youtube", {
      providerAssetId: youtubeVideoId,
      playbackUrl: buildYouTubeEmbedUrl(youtubeVideoId),
      thumbnailUrl: getYouTubeThumbnailUrl(youtubeVideoId),
      payload: { source_url: youtubeInput.trim() },
    });
  };

  const handleYoutubeRemove = () => {
    onExternalVideoChange(null, null);
    setYoutubeInput("");
    setYoutubeTouched(false);
  };

  // Smart Player handlers
  const smartplayerVideoId = extractSmartPlayerVideoId(smartplayerInput);
  const isSmartplayerValid = smartplayerInput.trim() === "" || smartplayerVideoId !== null;
  const hasSmartplayerVideo = videoProvider === "smartplayer" && videoProviderAssetId;
  const savedSmartplayerId = videoProviderAssetId && videoProvider === "smartplayer" ? videoProviderAssetId : null;

  const handleSmartplayerRemove = () => {
    onExternalVideoChange(null, null);
    setSmartplayerInput("");
    setSmartplayerTouched(false);
  };

  // Auto-sync: when the input changes and is valid, update the draft immediately
  // so the parent's dirty state picks it up → Salvar button activates.
  const prevSmartplayerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (smartplayerVideoId && smartplayerVideoId !== prevSmartplayerIdRef.current) {
      prevSmartplayerIdRef.current = smartplayerVideoId;
      onExternalVideoChange("smartplayer", {
        providerAssetId: smartplayerVideoId,
        playbackUrl: buildSmartPlayerEmbedUrl(smartplayerVideoId),
        payload: { source_url: smartplayerInput.trim() },
      });
    } else if (!smartplayerVideoId && smartplayerTouched && smartplayerInput.trim() === "") {
      // Cleared the input → remove video
      if (prevSmartplayerIdRef.current) {
        prevSmartplayerIdRef.current = null;
        onExternalVideoChange(null, null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartplayerVideoId]);

  // ── Vimeo ───────────────────────────────────────────────────────
  const { isConnected: vimeoConnected, isLoading: vimeoIntegrationLoading } = useVimeoIntegration();

  const [vimeoSearch, setVimeoSearch] = useState("");
  const debouncedVimeoSearch = useDebouncedValue(vimeoSearch, 400);
  const vimeoScrollRef = useRef<HTMLDivElement>(null);

  const {
    videos: vimeoVideos,
    isLoading: vimeoLoading,
    isError: vimeoError,
    error: vimeoErrorDetails,
    refetch: refetchVimeo,
    fetchNextPage: fetchNextVimeoPage,
    hasNextPage: hasMoreVimeo,
    isFetchingNextPage: loadingMoreVimeo,
  } = useVimeoVideos({
    enabled: activeSubTab === "vimeo" && vimeoConnected,
    perPage: 20,
    query: debouncedVimeoSearch || undefined,
    tenantId: tenant?.id,
  });

  const handleVimeoSelect = (video: VimeoVideoItem) => {
    if (!video.can_select) return;
    onExternalVideoChange("vimeo", {
      providerAssetId: video.id,
      playbackUrl: video.playback_url,
      thumbnailUrl: video.thumbnail_url,
      duration: video.duration_seconds,
      payload: {
        source_url: video.source_url,
        title: video.title,
        privacy_embed: video.privacy_embed,
        privacy_view: video.privacy_view,
        project_name: video.project_name,
      },
    });
  };

  // Handle scroll for infinite loading (Vimeo)
  const handleVimeoScroll = useCallback(() => {
    if (!vimeoScrollRef.current || loadingMoreVimeo || !hasMoreVimeo) return;
    const { scrollTop, scrollHeight, clientHeight } = vimeoScrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchNextVimeoPage();
    }
  }, [loadingMoreVimeo, hasMoreVimeo, fetchNextVimeoPage]);

  // ── Panda Video ────────────────────────────────────────────────
  const { isConnected: pandavideoConnected, isLoading: pandavideoIntegrationLoading } = useSimpleIntegration("pandavideo", {
    connectFnName: "pandavideo-connect",
    disconnectFnName: "pandavideo-disconnect",
  });

  const [pandavideoSearch, setPandavideoSearch] = useState("");
  const debouncedPandavideoSearch = useDebouncedValue(pandavideoSearch, 400);
  const pandavideoScrollRef = useRef<HTMLDivElement>(null);

  const {
    videos: pandavideoVideos,
    isLoading: pandavideoLoading,
    isError: pandavideoError,
    error: pandavideoErrorDetails,
    refetch: refetchPandavideo,
    fetchNextPage: fetchNextPandavideoPage,
    hasNextPage: hasMorePandavideo,
    isFetchingNextPage: loadingMorePandavideo,
  } = usePandaVideoVideos({
    enabled: activeSubTab === "pandavideo" && pandavideoConnected,
    perPage: 20,
    query: debouncedPandavideoSearch || undefined,
    tenantId: tenant?.id,
  });

  const handlePandavideoSelect = (video: PandaVideoItem) => {
    if (!video.can_select) return;
    onExternalVideoChange("pandavideo", {
      providerAssetId: video.id,
      playbackUrl: video.playback_url,
      thumbnailUrl: video.thumbnail_url,
      duration: video.duration_seconds,
      payload: {
        source_url: video.source_url,
        title: video.title,
      },
    });
  };

  const handlePandavideoScroll = useCallback(() => {
    if (!pandavideoScrollRef.current || loadingMorePandavideo || !hasMorePandavideo) return;
    const { scrollTop, scrollHeight, clientHeight } = pandavideoScrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchNextPandavideoPage();
    }
  }, [loadingMorePandavideo, hasMorePandavideo, fetchNextPandavideoPage]);

  // ── Wistia ─────────────────────────────────────────────────────
  const { isConnected: wistiaConnected, isLoading: wistiaIntegrationLoading } = useSimpleIntegration("wistia", {
    connectFnName: "wistia-connect",
    disconnectFnName: "wistia-disconnect",
  });

  const [wistiaSearch, setWistiaSearch] = useState("");
  const debouncedWistiaSearch = useDebouncedValue(wistiaSearch, 400);
  const wistiaScrollRef = useRef<HTMLDivElement>(null);

  const {
    videos: wistiaVideos,
    isLoading: wistiaLoading,
    isError: wistiaError,
    error: wistiaErrorDetails,
    refetch: refetchWistia,
    fetchNextPage: fetchNextWistiaPage,
    hasNextPage: hasMoreWistia,
    isFetchingNextPage: loadingMoreWistia,
  } = useWistiaVideos({
    enabled: activeSubTab === "wistia" && wistiaConnected,
    perPage: 20,
    query: debouncedWistiaSearch || undefined,
    tenantId: tenant?.id,
  });

  const handleWistiaSelect = (video: WistiaVideoItem) => {
    if (!video.can_select) return;
    onExternalVideoChange("wistia", {
      providerAssetId: video.id,
      playbackUrl: video.playback_url,
      thumbnailUrl: video.thumbnail_url,
      duration: video.duration_seconds,
      payload: {
        source_url: video.source_url,
        title: video.title,
      },
    });
  };

  const handleWistiaScroll = useCallback(() => {
    if (!wistiaScrollRef.current || loadingMoreWistia || !hasMoreWistia) return;
    const { scrollTop, scrollHeight, clientHeight } = wistiaScrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchNextWistiaPage();
    }
  }, [loadingMoreWistia, hasMoreWistia, fetchNextWistiaPage]);

  const integrationIcon = (src: string) => (
    <span
      className="size-4 inline-block"
      style={{
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage: `url(${src})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
    />
  );

  const subTabs: { id: VideoSubTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: "library", label: t("lessonEdit.video.tabLibrary"), icon: <Video className="size-4" /> },
    { id: "youtube", label: "YouTube", icon: integrationIcon("/brand/integrations/youtube-icon.svg") },
    { id: "vimeo", label: "Vimeo", icon: integrationIcon("/brand/integrations/vimeo-icon.svg") },
    { id: "smartplayer", label: "Smart Player", icon: integrationIcon("/brand/integrations/smartplayer-icon.svg") },
    { id: "pandavideo", label: "Panda Video", icon: <img src="/brand/integrations/pandavideo-icon.svg" alt="" className="size-4 object-contain" /> },
    { id: "wistia", label: "Wistia", icon: integrationIcon("/brand/integrations/wistia-icon.svg") },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6">
      <div>
        <h3 className="text-section mb-2">{t("lessonEdit.video.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("lessonEdit.video.subtitle")}
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveSubTab(tab.id)}
            disabled={tab.disabled}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab.disabled
                ? "text-muted-foreground/50 cursor-not-allowed"
                : activeSubTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Library sub-tab ═══ */}
      {activeSubTab === "library" && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Current library video indicator */}
          {selectedVideoAssetId && pinnedAsset && (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  className="relative w-40 h-24 rounded-lg overflow-hidden group shrink-0"
                  onClick={() => openLibraryPreview(pinnedAsset)}
                >
                  {pinnedAsset.asset_videos?.thumbnail_url ? (
                    <img
                      src={pinnedAsset.asset_videos.thumbnail_url}
                      alt={t("lessonEdit.video.thumbnailAlt")}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Video className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="size-8 text-white fill-white" />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pinnedAsset.title}</p>
                  {pinnedAsset.asset_videos?.duration_seconds && (
                    <p className="text-sm text-muted-foreground">
                      {t("lessonEdit.video.duration")} {Math.floor(pinnedAsset.asset_videos.duration_seconds / 60)}:
                      {(pinnedAsset.asset_videos.duration_seconds % 60).toString().padStart(2, "0")}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={onVideoRemove}>
                  <X className="size-4" />
                  {t("common.remove")}
                </Button>
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t("lessonEdit.video.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Video gallery - 4 columns */}
          <div
            ref={scrollContainerRef}
            onScroll={handleLibraryScroll}
            className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2"
          >
            {loadingAssets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="size-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("lessonEdit.video.noVideos")}
                  <br />
                  {t("lessonEdit.video.noVideosHint")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {availableAssets.map((asset) => (
                  <VideoThumbnail
                    key={asset.id}
                    asset={asset}
                    isCurrent={selectedVideoAssetId === asset.id}
                    onSelect={() => { prefillPinnedAsset(asset); onVideoSelect(asset.id); }}
                    onPlay={() => openLibraryPreview(asset)}
                  />
                ))}
              </div>
            )}

            {loadingMoreLibrary && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ YouTube sub-tab ═══ */}
      {activeSubTab === "youtube" && (
        <div className="space-y-4">
          {/* Saved YouTube video preview */}
          {hasYoutubeVideo && savedYoutubeId && (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start gap-4">
                <img
                  src={getYouTubeThumbnailUrl(savedYoutubeId)}
                  alt={t("lessonEdit.video.youtubeVideo")}
                  className="w-40 h-24 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Youtube className="size-4 text-red-500 shrink-0" />
                    <p className="font-medium truncate">
                      {t("lessonEdit.video.youtubeVideo")}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {youtubeSourceUrl}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleYoutubeRemove}>
                  <X className="size-4" />
                  {t("common.remove")}
                </Button>
              </div>
            </div>
          )}

          {/* YouTube URL input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("lessonEdit.video.youtubeLabel")}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t("lessonEdit.video.youtubePlaceholder")}
                  value={youtubeInput}
                  onChange={(e) => {
                    setYoutubeInput(e.target.value);
                    setYoutubeTouched(true);
                  }}
                  className={cn(
                    "pl-10",
                    youtubeTouched && !isYoutubeValid && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </div>
              <Button
                onClick={handleYoutubeConfirm}
                disabled={!youtubeVideoId || youtubeInput.trim() === youtubeSourceUrl}
              >
                <Check className="size-4" />
                {t("common.confirm")}
              </Button>
            </div>

            {/* Validation error */}
            {youtubeTouched && !isYoutubeValid && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                {t("lessonEdit.video.youtubeInvalid")}
              </p>
            )}

            {/* Hint */}
            <p className="text-xs text-muted-foreground">
              {t("lessonEdit.video.youtubeHint")}
            </p>
          </div>

          {/* Live preview of pasted URL */}
          {youtubeTouched && youtubeVideoId && youtubeInput.trim() !== youtubeSourceUrl && (
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground mb-3">{t("lessonEdit.video.preview", "Preview")}</p>
              <div className="flex items-start gap-4">
                <img
                  src={getYouTubeThumbnailUrl(youtubeVideoId)}
                  alt="YouTube preview"
                  className="w-40 h-24 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Youtube className="size-4 text-red-500 shrink-0" />
                    <p className="font-medium">{t("lessonEdit.video.youtubeVideo")}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {youtubeInput}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Vimeo sub-tab ═══ */}
      {activeSubTab === "vimeo" && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {vimeoIntegrationLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !vimeoConnected ? (
            /* Empty state: no Vimeo integration */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {t("lessonEdit.video.vimeoNotConnected")}
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/integrations">
                  {t("lessonEdit.video.vimeoConnectCta")}
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              {/* Current Vimeo video indicator */}
              {videoProvider === "vimeo" && videoProviderAssetId && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      className="relative w-40 h-24 rounded-lg overflow-hidden group shrink-0"
                      onClick={openVimeoPreview}
                    >
                      {videoThumbnailUrl ? (
                        <img
                          src={videoThumbnailUrl}
                          alt="Vimeo video"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Video className="size-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="size-8 text-white fill-white" />
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {(videoPayload?.title as string) || `Vimeo ${videoProviderAssetId}`}
                      </p>
                      {videoDuration != null && videoDuration > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("lessonEdit.video.duration")} {Math.floor(videoDuration / 60)}:
                          {(videoDuration % 60).toString().padStart(2, "0")}
                        </p>
                      )}
                      {videoPayload?.source_url && (
                        <a
                          href={videoPayload.source_url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="size-3" />
                          {t("lessonEdit.video.vimeoOpenOriginal")}
                        </a>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={onVideoRemove}>
                      <X className="size-4" />
                      {t("common.remove")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t("lessonEdit.video.vimeoSearchPlaceholder")}
                  value={vimeoSearch}
                  onChange={(e) => setVimeoSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Vimeo video grid — infinite scroll */}
              <div
                ref={vimeoScrollRef}
                onScroll={handleVimeoScroll}
                className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2"
              >
                {vimeoLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : vimeoError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="size-10 text-destructive mb-3" />
                    <p className="text-sm text-destructive font-medium mb-1">
                      {t("lessonEdit.video.vimeoError", "Erro ao carregar vídeos")}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {vimeoErrorDetails?.message}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => refetchVimeo()}>
                      {t("common.tryAgain", "Tentar novamente")}
                    </Button>
                  </div>
                ) : vimeoVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Video className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {t("lessonEdit.video.vimeoNoVideos")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {vimeoVideos.map((video) => (
                      <VimeoVideoCard
                        key={video.id}
                        video={video}
                        isCurrent={videoProvider === "vimeo" && videoProviderAssetId === video.id}
                        onSelect={() => handleVimeoSelect(video)}
                      />
                    ))}
                  </div>
                )}

                {loadingMoreVimeo && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Smart Player sub-tab ═══ */}
      {activeSubTab === "smartplayer" && (
        <div className="space-y-4">
          {/* Smart Player embed input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("lessonEdit.video.smartplayerLabel")}</label>
            <Textarea
              placeholder={t("lessonEdit.video.smartplayerPlaceholder")}
              value={smartplayerInput}
              onChange={(e) => {
                setSmartplayerInput(e.target.value);
                setSmartplayerTouched(true);
              }}
              rows={4}
              className={cn(
                "resize-none text-sm",
                smartplayerTouched && !isSmartplayerValid && "border-destructive focus-visible:ring-destructive"
              )}
            />

            {/* Validation error */}
            {smartplayerTouched && !isSmartplayerValid && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                {t("lessonEdit.video.smartplayerInvalid")}
              </p>
            )}

            {/* Hint */}
            <p className="text-xs text-muted-foreground">
              {t("lessonEdit.video.smartplayerHint")}
            </p>

            {/* Domain whitelist callout */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-4 py-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {t("lessonEdit.video.smartplayerDomainHint")}
              </p>
            </div>
          </div>

          {/* Live preview when valid ID is detected */}
          {smartplayerVideoId && (
            <div className="rounded-lg overflow-hidden">
              <iframe
                src={buildSmartPlayerEmbedUrl(smartplayerVideoId)}
                title={t("lessonEdit.video.smartplayerVideo")}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full border-0"
                style={{ aspectRatio: "16 / 9" }}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══ Panda Video sub-tab ═══ */}
      {activeSubTab === "pandavideo" && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {pandavideoIntegrationLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !pandavideoConnected ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {t("lessonEdit.video.pandavideoNotConnected")}
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/integrations">
                  {t("lessonEdit.video.pandavideoConnectCta")}
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              {/* Current Panda Video indicator */}
              {videoProvider === "pandavideo" && videoProviderAssetId && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start gap-4">
                    <div className="relative w-40 h-24 rounded-lg overflow-hidden shrink-0">
                      {videoThumbnailUrl ? (
                        <img src={videoThumbnailUrl} alt="Panda Video" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Video className="size-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {(videoPayload?.title as string) || `Panda Video ${videoProviderAssetId}`}
                      </p>
                      {videoDuration != null && videoDuration > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("lessonEdit.video.duration")} {Math.floor(videoDuration / 60)}:
                          {(videoDuration % 60).toString().padStart(2, "0")}
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={onVideoRemove}>
                      <X className="size-4" />
                      {t("common.remove")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t("lessonEdit.video.pandavideoSearchPlaceholder")}
                  value={pandavideoSearch}
                  onChange={(e) => setPandavideoSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Video grid — infinite scroll */}
              <div
                ref={pandavideoScrollRef}
                onScroll={handlePandavideoScroll}
                className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2"
              >
                {pandavideoLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pandavideoError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="size-10 text-destructive mb-3" />
                    <p className="text-sm text-destructive font-medium mb-1">
                      {t("lessonEdit.video.pandavideoError", "Erro ao carregar vídeos")}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {pandavideoErrorDetails?.message}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => refetchPandavideo()}>
                      {t("common.tryAgain", "Tentar novamente")}
                    </Button>
                  </div>
                ) : pandavideoVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Video className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {t("lessonEdit.video.pandavideoNoVideos")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {pandavideoVideos.map((video) => (
                      <ExternalVideoCard
                        key={video.id}
                        video={video}
                        isCurrent={videoProvider === "pandavideo" && videoProviderAssetId === video.id}
                        onSelect={() => handlePandavideoSelect(video)}
                      />
                    ))}
                  </div>
                )}

                {loadingMorePandavideo && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Wistia sub-tab ═══ */}
      {activeSubTab === "wistia" && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {wistiaIntegrationLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !wistiaConnected ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {t("lessonEdit.video.wistiaNotConnected")}
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/integrations">
                  {t("lessonEdit.video.wistiaConnectCta")}
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              {/* Current Wistia video indicator */}
              {videoProvider === "wistia" && videoProviderAssetId && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start gap-4">
                    <div className="relative w-40 h-24 rounded-lg overflow-hidden shrink-0">
                      {videoThumbnailUrl ? (
                        <img src={videoThumbnailUrl} alt="Wistia video" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Video className="size-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {(videoPayload?.title as string) || `Wistia ${videoProviderAssetId}`}
                      </p>
                      {videoDuration != null && videoDuration > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("lessonEdit.video.duration")} {Math.floor(videoDuration / 60)}:
                          {(videoDuration % 60).toString().padStart(2, "0")}
                        </p>
                      )}
                      {videoPayload?.source_url && (
                        <a
                          href={videoPayload.source_url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="size-3" />
                          {t("lessonEdit.video.wistiaOpenOriginal")}
                        </a>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={onVideoRemove}>
                      <X className="size-4" />
                      {t("common.remove")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t("lessonEdit.video.wistiaSearchPlaceholder")}
                  value={wistiaSearch}
                  onChange={(e) => setWistiaSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Video grid — infinite scroll */}
              <div
                ref={wistiaScrollRef}
                onScroll={handleWistiaScroll}
                className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2"
              >
                {wistiaLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : wistiaError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="size-10 text-destructive mb-3" />
                    <p className="text-sm text-destructive font-medium mb-1">
                      {t("lessonEdit.video.wistiaError", "Erro ao carregar vídeos")}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {wistiaErrorDetails?.message}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => refetchWistia()}>
                      {t("common.tryAgain", "Tentar novamente")}
                    </Button>
                  </div>
                ) : wistiaVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Video className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {t("lessonEdit.video.wistiaNoVideos")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {wistiaVideos.map((video) => (
                      <ExternalVideoCard
                        key={video.id}
                        video={video}
                        isCurrent={videoProvider === "wistia" && videoProviderAssetId === video.id}
                        onSelect={() => handleWistiaSelect(video)}
                      />
                    ))}
                  </div>
                )}

                {loadingMoreWistia && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video preview modal (lazy loaded) */}
      {isPreviewOpen && (
        <Suspense fallback={null}>
          <VideoPlayerModal
            open
            onOpenChange={(open) => !open && closePreview()}
            gumletAssetId={previewGumletId}
            embedUrl={previewEmbedUrl}
            title={previewTitle}
            videoSettings={tenant?.video_settings}
            fallbackColor={tenant?.icon_color ?? tenant?.primary_color}
          />
        </Suspense>
      )}
    </div>
  );
}

// ── Gumlet Library Thumbnail ──────────────────────────────────────

interface VideoThumbnailProps {
  asset: AssetWithVideo;
  isCurrent: boolean;
  onSelect: () => void;
  onPlay: () => void;
}

function VideoThumbnail({ asset, isCurrent, onSelect, onPlay }: VideoThumbnailProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden border transition-colors",
        isCurrent
          ? "border-primary ring-2 ring-primary/20 cursor-pointer"
          : "border-border hover:border-muted-foreground/50 cursor-pointer"
      )}
      onClick={isCurrent ? onPlay : onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative">
        {asset.asset_videos?.thumbnail_url ? (
          <img
            src={asset.asset_videos.thumbnail_url}
            alt={asset.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Video className="size-8 text-muted-foreground" />
          </div>
        )}

        {/* Current badge with play icon */}
        {isCurrent && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              <Play className="size-4 fill-current" />
              {t("lessonEdit.video.selected")}
            </div>
          </div>
        )}

        {/* Duration badge */}
        {asset.asset_videos?.duration_seconds && !isCurrent && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {Math.floor(asset.asset_videos.duration_seconds / 60)}:
            {(asset.asset_videos.duration_seconds % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="p-3">
        <p className="text-sm font-medium truncate">{asset.title}</p>
      </div>
    </div>
  );
}

// ── Vimeo Video Card ──────────────────────────────────────────────

interface VimeoVideoCardProps {
  video: VimeoVideoItem;
  isCurrent: boolean;
  onSelect: () => void;
}

function VimeoVideoCard({ video, isCurrent, onSelect }: VimeoVideoCardProps) {
  const { t } = useTranslation();
  const isDisabled = !video.can_select;
  const isWhitelist = video.privacy_embed === "whitelist";

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden border transition-colors",
        isCurrent
          ? "border-primary ring-2 ring-primary/20"
          : isDisabled
            ? "border-border opacity-50 cursor-not-allowed"
            : "border-border hover:border-muted-foreground/50 cursor-pointer"
      )}
      onClick={!isDisabled && !isCurrent ? onSelect : undefined}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Video className="size-8 text-muted-foreground" />
          </div>
        )}

        {/* Current badge */}
        {isCurrent && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              <Check className="size-4" />
              {t("lessonEdit.video.selected")}
            </div>
          </div>
        )}

        {/* Disabled overlay */}
        {isDisabled && !isCurrent && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-black/80 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Lock className="size-3" />
              {t("lessonEdit.video.vimeoEmbedPrivate")}
            </div>
          </div>
        )}

        {/* Whitelist warning */}
        {isWhitelist && !isDisabled && !isCurrent && (
          <div className="absolute top-2 left-2">
            <div className="bg-warning/90 text-warning-foreground px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1" title={t("lessonEdit.video.vimeoWhitelistHint")}>
              <AlertTriangle className="size-3" />
              whitelist
            </div>
          </div>
        )}

        {/* Duration badge */}
        {video.duration_seconds > 0 && !isCurrent && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {Math.floor(video.duration_seconds / 60)}:
            {(video.duration_seconds % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium truncate">{video.title}</p>
        {video.project_name && (
          <p className="text-xs text-muted-foreground truncate">{video.project_name}</p>
        )}
      </div>
    </div>
  );
}

// ── External Video Card (Panda Video, Wistia) ────────────────────

interface ExternalVideoCardProps {
  video: { id: string; title: string; thumbnail_url: string | null; duration_seconds: number; can_select: boolean };
  isCurrent: boolean;
  onSelect: () => void;
}

function ExternalVideoCard({ video, isCurrent, onSelect }: ExternalVideoCardProps) {
  const { t } = useTranslation();
  const isDisabled = !video.can_select;

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden border transition-colors",
        isCurrent
          ? "border-primary ring-2 ring-primary/20"
          : isDisabled
            ? "border-border opacity-50 cursor-not-allowed"
            : "border-border hover:border-muted-foreground/50 cursor-pointer"
      )}
      onClick={!isDisabled && !isCurrent ? onSelect : undefined}
    >
      <div className="aspect-video relative">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Video className="size-8 text-muted-foreground" />
          </div>
        )}

        {isCurrent && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              <Check className="size-4" />
              {t("lessonEdit.video.selected")}
            </div>
          </div>
        )}

        {video.duration_seconds > 0 && !isCurrent && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {Math.floor(video.duration_seconds / 60)}:
            {(video.duration_seconds % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-medium truncate">{video.title}</p>
      </div>
    </div>
  );
}
