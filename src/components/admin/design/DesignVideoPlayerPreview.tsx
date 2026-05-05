import { PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildGumletEmbedUrl } from "@/lib/video-settings";
import type { VideoSettings } from "@/lib/video-settings";

const DEFAULT_PREVIEW_ASSET_ID = "69de96da0e45fb2cfced7978";
const ENV_PREVIEW_ASSET_ID = import.meta.env.VITE_GUMLET_PREVIEW_ASSET_ID
  ?.trim();
const FALLBACK_PREVIEW_ASSET_ID = ENV_PREVIEW_ASSET_ID || DEFAULT_PREVIEW_ASSET_ID;

interface DesignVideoPlayerPreviewProps {
  previewMode?: "desktop" | "mobile";
  videoSettings: VideoSettings;
  fallbackColor: string | null;
}

export default function DesignVideoPlayerPreview({
  previewMode = "desktop",
  videoSettings,
  fallbackColor,
}: DesignVideoPlayerPreviewProps) {
  const { t } = useTranslation();
  const isMobile = previewMode === "mobile";
  const resolvedAssetId = FALLBACK_PREVIEW_ASSET_ID;
  const embedUrl = buildGumletEmbedUrl(resolvedAssetId, videoSettings, {
    fallbackColor,
  });

  return (
    <div className="h-full w-full bg-background p-4 md:p-6">
      <div className="h-full w-full rounded-xl border border-border bg-card p-3 md:p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium truncate">
            {t("designPage.videoPlayer.previewTitle")}
          </p>
          <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-1 shrink-0">
            {t("designPage.videoPlayer.previewFallback")}
          </span>
        </div>

        <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-muted">
          <div
            className="mx-auto h-full"
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : "920px",
              aspectRatio: "16 / 9",
            }}
          >
            <iframe
              src={embedUrl}
              title={t("designPage.videoPlayer.previewTitle")}
              className="size-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PlayCircle className="size-3.5" />
          <span>{t("designPage.videoPlayer.previewHint")}</span>
        </div>
      </div>
    </div>
  );
}
