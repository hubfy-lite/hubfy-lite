import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Film,
  FileText,
  Play,
  Copy,
  Download,
  Check,
  Loader2,
  Link,
  Info,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn, formatDateTime } from "@/lib/utils";
import { buildGumletEmbedUrl } from "@/lib/video-settings";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import type { AssetWithDetails } from "@/hooks/useAssets";
import type { Database } from "@/integrations/supabase/types";

type AssetStatus = Database["public"]["Enums"]["asset_status"];

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}


function getStatusVariant(status: AssetStatus): BadgeVariant {
  switch (status) {
    case "uploading": return "amber";
    case "processing": return "blue";
    case "ready": return "green";
    case "failed": return "red";
    default: return "gray";
  }
}

interface CopyButtonProps {
  value: string;
  successKey: string;
  label: string;
  icon?: React.ReactNode;
}

function CopyButton({ value, successKey: _successKey, label, icon }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          {copied ? <Check className="size-3.5" /> : (icon ?? <Copy className="size-3.5" />)}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {copied ? "Copiado!" : `Copiar ${label.toLowerCase()}`}
      </TooltipContent>
    </Tooltip>
  );
}

interface AssetDetailSheetProps {
  asset: AssetWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, title: string, description: string | null) => void;
  isUpdating: boolean;
  onPlayVideo?: (gumletAssetId: string, title: string) => void;
  videoSettings?: unknown;
  fallbackColor?: string | null;
  captionsEnabled?: boolean;
}

export function AssetDetailSheet({
  asset,
  open,
  onOpenChange,
  onUpdate,
  isUpdating,
  onPlayVideo,
  videoSettings,
  fallbackColor,
  captionsEnabled,
}: AssetDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbError, setThumbError] = useState(false);
  const [signedThumbUrl, setSignedThumbUrl] = useState<string | null>(null);

  // Sync form when asset changes
  useEffect(() => {
    if (asset) {
      setTitle(asset.title);
      setDescription(asset.description ?? "");
      setThumbError(false);
      setSignedThumbUrl(null);
    }
  }, [asset?.id]);

  // Load signed URL for image file thumbnails
  useEffect(() => {
    if (!asset || asset.type !== "file") return;
    const path = asset.asset_files?.object_path;
    const bucket = asset.asset_files?.bucket ?? "assets";
    if (!path || !asset.mime_type?.startsWith("image/")) return;

    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setSignedThumbUrl(data.signedUrl);
      });
  }, [asset?.id]);

  if (!asset) return null;

  const isVideo = asset.type === "video";
  const isFile = asset.type === "file";
  const isReady = asset.status === "ready";
  const isProcessing = asset.status === "processing" || asset.status === "uploading";

  const videoThumbnail = isVideo ? asset.asset_videos?.thumbnail_url ?? null : null;
  const gumletAssetId = isVideo ? asset.asset_videos?.gumlet_asset_id ?? null : null;
  const embedUrl = gumletAssetId
    ? buildGumletEmbedUrl(gumletAssetId, videoSettings, {
      fallbackColor,
      captionsEnabled,
    })
    : null;

  const isImageFile = isFile && !!asset.mime_type?.startsWith("image/");
  const previewUrl = isVideo ? videoThumbnail : (isImageFile ? signedThumbUrl : null);

  const sizeBytes = isVideo
    ? asset.asset_videos?.original_size_bytes
    : null; // size_bytes not available on asset_files

  const canEdit = isReady || isFile; // files are always editable; videos only when ready
  const canPlayVideo = isVideo && isReady && !!gumletAssetId;
  const canDownload = isFile && isReady && !!asset.asset_files?.object_path;

  const isDirty = title.trim() !== asset.title || (description.trim() || null) !== (asset.description ?? null);
  const canSave = isDirty && title.trim().length > 0 && !isUpdating;

  const handleSave = () => {
    if (!canSave) return;
    onUpdate(asset.id, title.trim(), description.trim() || null);
  };

  const handleDownload = async () => {
    const path = asset.asset_files?.object_path;
    const bucket = asset.asset_files?.bucket ?? "assets";
    if (!path) return;
    const filename = asset.asset_files?.original_filename || asset.title || "download";
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600, { download: filename });
    if (error || !data?.signedUrl) {
      toast.error(t("assets.downloadError"));
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[720px] flex flex-col gap-0 p-0 overflow-y-auto">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 flex-none">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {isVideo ? (
                <Film className="size-5 text-primary" />
              ) : (
                <FileText className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold leading-snug truncate">
                {asset.title}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {isVideo ? t("assets.typeLabels.video") : t("assets.typeLabels.file")}
                </span>
                <Badge
                  variant={getStatusVariant(asset.status)}
                  className="text-xs px-1.5 py-0"
                >
                  {(asset.status === "uploading" || asset.status === "processing") && (
                    <Loader2 className="size-2.5 animate-spin mr-1" />
                  )}
                  {t(`assets.statusLabels.${asset.status}`)}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        <div className="flex-1 flex flex-col gap-6 px-6 py-5">
          {/* Preview */}
          {(previewUrl && !thumbError) ? (
            <div className="relative rounded-xl overflow-hidden bg-muted aspect-video w-full">
              <img
                src={previewUrl}
                alt={asset.title}
                className="size-full object-cover"
                onError={() => setThumbError(true)}
              />
              {canPlayVideo && (
                <button
                  type="button"
                  onClick={() => onPlayVideo?.(gumletAssetId!, asset.title)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <div className="size-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="size-6 text-white fill-white" />
                  </div>
                </button>
              )}
            </div>
          ) : (
            <div className={cn(
              "rounded-xl bg-muted flex items-center justify-center aspect-video w-full",
              canPlayVideo && "cursor-pointer hover:bg-muted/70 transition-colors"
            )}
              onClick={canPlayVideo ? () => onPlayVideo?.(gumletAssetId!, asset.title) : undefined}
            >
              {isVideo ? (
                <Film className="size-10 text-muted-foreground/40" />
              ) : (
                <FileText className="size-10 text-muted-foreground/40" />
              )}
            </div>
          )}

          {/* Processing notice */}
          {isVideo && isProcessing && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-primary/80 leading-relaxed">
                {t("assets.sheet.processingNote")}
                {asset.asset_videos?.progress_pct != null && (
                  <span className="ml-1 font-medium">{asset.asset_videos.progress_pct}%</span>
                )}
              </p>
            </div>
          )}

          {/* Edit form */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-title">{t("assets.sheet.name")}</Label>
              <Input
                id="asset-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEdit || isUpdating}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-description">
                {t("assets.sheet.description")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Textarea
                {...NO_AUTOFILL_PROPS}
                id="asset-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit || isUpdating}
                placeholder={t("assets.sheet.descriptionPlaceholder")}
                className="resize-none"
                rows={3}
                maxLength={500}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              className="self-end"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                t("common.save")
              )}
            </Button>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("assets.sheet.infoTitle")}
            </h3>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {asset.mime_type && (
                <>
                  <span className="text-muted-foreground">{t("assets.sheet.mimeType")}</span>
                  <span className="text-xs leading-5">{asset.mime_type}</span>
                </>
              )}
              {sizeBytes && (
                <>
                  <span className="text-muted-foreground">{t("assets.sheet.fileSize")}</span>
                  <span>{formatBytes(sizeBytes)}</span>
                </>
              )}
              {isVideo && asset.asset_videos?.width && asset.asset_videos?.height && (
                <>
                  <span className="text-muted-foreground">{t("assets.sheet.resolution")}</span>
                  <span>{asset.asset_videos.width}×{asset.asset_videos.height}</span>
                </>
              )}
              <>
                <span className="text-muted-foreground">{t("assets.sheet.createdAt")}</span>
                <span>{formatDateTime(asset.created_at, lang)}</span>
              </>
              {asset.updated_at && asset.updated_at !== asset.created_at && (
                <>
                  <span className="text-muted-foreground">{t("assets.sheet.updatedAt")}</span>
                  <span>{formatDateTime(asset.updated_at, lang)}</span>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("assets.sheet.actionsTitle")}
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                value={asset.id}
                successKey="idCopied"
                label={t("common.copyId")}
              />
              {embedUrl && isReady && (
                <CopyButton
                  value={embedUrl}
                  successKey="urlCopied"
                  label={t("assets.sheet.copyEmbedUrl")}
                  icon={<Link className="size-3.5" />}
                />
              )}
              {canDownload && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  <Download className="size-3.5" />
                  {t("assets.sheet.download")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
