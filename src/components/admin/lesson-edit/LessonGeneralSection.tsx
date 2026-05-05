import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon, Search, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getLessonThumbnailUrl } from "@/lib/storage-urls";
import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";
import { CoverCropDialog } from "@/components/admin/CoverCropDialog";
import { isUnsplashConfigured } from "@/lib/unsplash";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

interface LessonGeneralSectionProps {
  lessonId: string;
  tenantId: string;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  thumbnailUrl: string;
  onThumbnailUrlChange: (value: string) => void;
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const LESSON_THUMBNAIL_ASPECT = 16 / 9;
const LESSON_THUMBNAIL_WIDTH = 1280;
const LESSON_THUMBNAIL_HEIGHT = 720;

export function LessonGeneralSection({
  lessonId,
  tenantId,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  thumbnailUrl,
  onThumbnailUrlChange,
}: LessonGeneralSectionProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

  const thumbnailPreviewUrl = thumbnailUrl
    ? withCacheBust(getLessonThumbnailUrl(thumbnailUrl), cacheBust)
    : "";

  useEffect(() => {
    return () => {
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    };
  }, [cropImageSrc]);

  const openCropDialog = useCallback((source: File | Blob) => {
    if (source instanceof File) {
      // Validate file type
      if (!ACCEPTED_IMAGE_TYPES.includes(source.type)) {
        toast.error(t("lessonEdit.general.invalidFormat"));
        return;
      }

      // Validate file size
      if (source.size > MAX_FILE_SIZE) {
        toast.error(t("lessonEdit.general.fileTooLarge"));
        return;
      }
    }

    const objectUrl = URL.createObjectURL(source);
    setCropImageSrc(objectUrl);
    setCropDialogOpen(true);
  }, [t]);

  const handleCropDialogOpenChange = useCallback((open: boolean) => {
    setCropDialogOpen(open);
    if (!open) {
      setCropImageSrc("");
    }
  }, []);

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropDialogOpen(false);
    setCropImageSrc("");
    setUploading(true);

    try {
      const filePath = `tenant/${tenantId}/lessons/${lessonId}/thumbnail.webp`;

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(filePath, blob, { upsert: true, contentType: "image/webp" });

      if (uploadError) throw uploadError;

      onThumbnailUrlChange(filePath);
      setCacheBust(Date.now());
      toast.success(t("lessonEdit.general.uploaded"));
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(t("lessonEdit.general.uploadError"));
    } finally {
      setUploading(false);
    }
  }, [lessonId, tenantId, onThumbnailUrlChange, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      openCropDialog(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      openCropDialog(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleUnsplashSelect = useCallback((blob: Blob) => {
    openCropDialog(blob);
  }, [openCropDialog]);

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleRemoveThumbnail = () => {
    onThumbnailUrlChange("");
    setCacheBust(Date.now());
  };

  const previewFrameClassName = "w-80 aspect-video";

  const uploadAreaClassName = cn(
    "flex flex-col items-center justify-center w-80 aspect-video border-2 border-dashed rounded-xl cursor-pointer transition-colors",
    dragOver
      ? "border-primary bg-primary/5"
      : "border-border hover:border-muted-foreground/50 hover:bg-muted/50",
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-section mb-2">{t("lessonEdit.general.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("lessonEdit.general.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        <Field orientation="split">
          <FieldContent>
            <FieldLabel>ID</FieldLabel>
            <FieldDescription>ID único da aula.</FieldDescription>
          </FieldContent>
          <FieldControl>
            <div className="flex items-center gap-2">
              <Input
                value={lessonId}
                variant="readOnly"
                readOnly
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(lessonId);
                  toast.success(t("common.idCopied"));
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </FieldControl>
        </Field>

        <div className="border-t border-border" />

        <Field orientation="split">
          <FieldContent>
            <FieldLabel htmlFor="lesson-title">{t("lessonEdit.general.titleLabel")}</FieldLabel>
            <FieldDescription>{t("lessonEdit.general.titleDescription")}</FieldDescription>
          </FieldContent>
          <FieldControl>
            <Input
              id="lesson-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={t("lessonEdit.general.titlePlaceholder")}
            />
          </FieldControl>
        </Field>

        <div className="border-t border-border" />

        <Field orientation="split">
          <FieldContent>
            <FieldLabel htmlFor="lesson-description">
              {t("lessonEdit.general.descriptionLabel")}
            </FieldLabel>
            <FieldDescription>
              {t("lessonEdit.general.descriptionDescription")}
            </FieldDescription>
          </FieldContent>
          <FieldControl>
            <Textarea
              {...NO_AUTOFILL_PROPS}
              id="lesson-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder={t("lessonEdit.general.descriptionPlaceholder")}
              rows={3}
            />
          </FieldControl>
        </Field>

        <div className="border-t border-border" />

        <Field orientation="split">
          <FieldContent>
            <FieldLabel>{t("lessonEdit.general.thumbnailLabel")}</FieldLabel>
            <FieldDescription>{t("lessonEdit.general.dropFormats")}</FieldDescription>
          </FieldContent>
          <FieldControl>
            {thumbnailUrl ? (
              <>
                <div className={cn("relative group overflow-hidden rounded-xl border border-border bg-muted", previewFrameClassName)}>
                  <img
                    src={thumbnailPreviewUrl}
                    alt={t("lessonEdit.general.thumbnailAlt")}
                    className="size-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/images/placeholder.svg";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={uploading}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="pointer-events-none"
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        {t("lessonEdit.general.change")}
                      </Button>
                    </label>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveThumbnail}
                      disabled={uploading}
                    >
                      <X className="size-4" />
                      {t("common.remove")}
                    </Button>
                  </div>
                </div>
                {isUnsplashConfigured() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setUnsplashOpen(true)}
                  >
                    <Search className="size-3.5 mr-1.5" />
                    {t("unsplash.searchButton")}
                  </Button>
                )}
              </>
            ) : (
            <>
              {/* Upload drop zone */}
              <label
                className={uploadAreaClassName}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="size-8 text-muted-foreground animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="size-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {t("lessonEdit.general.dropHint")}
                    </span>
                    <span className="text-xs text-muted-foreground/70 mt-1">
                      {t("lessonEdit.general.dropFormats")}
                    </span>
                  </>
                )}
              </label>
              {isUnsplashConfigured() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setUnsplashOpen(true)}
                >
                  <Search className="size-3.5 mr-1.5" />
                  {t("unsplash.searchButton")}
                </Button>
              )}
            </>
            )}
          </FieldControl>
        </Field>

        <UnsplashPickerDialog
          open={unsplashOpen}
          onOpenChange={setUnsplashOpen}
          onSelect={(blob) => handleUnsplashSelect(blob)}
        />

        <CoverCropDialog
          open={cropDialogOpen}
          onOpenChange={handleCropDialogOpenChange}
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          dialogTitle="Recortar thumbnail"
          aspect={LESSON_THUMBNAIL_ASPECT}
          targetWidth={LESSON_THUMBNAIL_WIDTH}
          targetHeight={LESSON_THUMBNAIL_HEIGHT}
          dialogDescription="Ajuste a área de recorte para o formato horizontal 16:9"
        />
      </div>
    </div>
  );
}

function withCacheBust(url: string, key: number): string {
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}t=${key}`;
}
