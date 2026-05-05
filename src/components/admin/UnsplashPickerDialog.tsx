import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Search, RectangleHorizontal, RectangleVertical, Square } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  searchPhotos,
  downloadPhoto,
  type UnsplashPhoto,
  type UnsplashOrientation,
} from "@/lib/unsplash";
import { toast } from "sonner";

const DEFAULT_QUERY = "startup";

function getAspectRatio(orientation: UnsplashOrientation | ""): number {
  switch (orientation) {
    case "portrait":
      return 3 / 4;
    case "squarish":
      return 1;
    default:
      return 16 / 10;
  }
}

function getGridCols(orientation: UnsplashOrientation | ""): string {
  switch (orientation) {
    case "portrait":
      return "grid-cols-2 sm:grid-cols-4";
    case "squarish":
      return "grid-cols-2 sm:grid-cols-4";
    default:
      return "grid-cols-2 sm:grid-cols-3";
  }
}

/* ------------------------------------------------------------------ */
/*  PhotoCard                                                          */
/* ------------------------------------------------------------------ */
function PhotoCard({
  photo,
  isSelected,
  onSelect,
  aspectRatio,
}: {
  photo: UnsplashPhoto;
  isSelected: boolean;
  onSelect: () => void;
  aspectRatio: number;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-lg border-2 overflow-hidden transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-muted-foreground/40",
      )}
    >
      <AspectRatio ratio={aspectRatio} className="bg-muted relative size-full">
        <img
          alt={photo.alt_description || "Unsplash photo"}
          src={photo.urls.small}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cn(
            "size-full rounded-lg object-cover transition-all duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      </AspectRatio>

      {/* Hover overlay with photographer name */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={`${photo.user.links.html}?utm_source=hubfy&utm_medium=referral`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-white/90 hover:text-white truncate block"
        >
          {t("unsplash.photoBy")} {photo.user.name}
        </a>
      </div>

      {/* Selected badge */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
          <Check className="size-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  UnsplashPickerDialog                                               */
/* ------------------------------------------------------------------ */
interface UnsplashPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (blob: Blob) => void;
  defaultQuery?: string;
}

export default function UnsplashPickerDialog({
  open,
  onOpenChange,
  onSelect,
  defaultQuery,
}: UnsplashPickerDialogProps) {
  const { t } = useTranslation();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 400);
  const [orientation, setOrientation] = useState<UnsplashOrientation | "">("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null);
  const [downloading, setDownloading] = useState(false);
  const fallbackQuery = defaultQuery?.trim() || DEFAULT_QUERY;
  const normalizedQuery = debouncedQuery.trim();

  // The effective query: user query or the provided default fallback
  const effectiveQuery = normalizedQuery.length >= 2
    ? normalizedQuery
    : fallbackQuery;

  // Search whenever effective query or orientation changes
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const doSearch = async () => {
      setLoading(true);
      setPage(1);
      setSelectedPhoto(null);
      try {
        const data = await searchPhotos(
          effectiveQuery,
          1,
          20,
          orientation || undefined,
        );
        if (!cancelled) {
          setPhotos(data.results);
          setTotalPages(data.total_pages);
        }
      } catch {
        if (!cancelled) toast.error(t("unsplash.searchError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doSearch();
    return () => { cancelled = true; };
  }, [open, effectiveQuery, orientation]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setPhotos([]);
      setPage(1);
      setTotalPages(0);
      setSelectedPhoto(null);
      setOrientation("");
    }
  }, [open]);

  // Load more results
  const loadMore = useCallback(async () => {
    if (loading || page >= totalPages) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const data = await searchPhotos(
        effectiveQuery,
        nextPage,
        20,
        orientation || undefined,
      );
      setPhotos((prev) => [...prev, ...data.results]);
      setPage(nextPage);
    } catch {
      toast.error(t("unsplash.loadMoreError"));
    } finally {
      setLoading(false);
    }
  }, [loading, page, totalPages, effectiveQuery, orientation]);

  // Confirm selection: download blob and pass to parent
  const handleConfirm = useCallback(async () => {
    if (!selectedPhoto) return;
    setDownloading(true);
    try {
      const blob = await downloadPhoto(selectedPhoto);
      onSelect(blob);
      onOpenChange(false);
    } catch {
      toast.error(t("unsplash.downloadError"));
    } finally {
      setDownloading(false);
    }
  }, [selectedPhoto, onSelect, onOpenChange]);

  const hasPhotos = photos.length > 0;
  const isCustomSearch = normalizedQuery.length >= 2;
  const showNoResults = isCustomSearch && !loading && !hasPhotos;
  const aspectRatio = getAspectRatio(orientation);
  const gridCols = getGridCols(orientation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-3xl max-h-[90vh] gap-0 flex flex-col"
      >
        <DialogHeader className="pb-4">
          <DialogTitle>{t("unsplash.dialogTitle")}</DialogTitle>
        </DialogHeader>

        {/* Search bar + orientation filter */}
        <div className="flex gap-2 pb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("unsplash.searchPlaceholder")}
              className="pl-9"
              autoFocus
            />
          </div>

          <ToggleGroup
            type="single"
            value={orientation}
            onValueChange={(val) => setOrientation(val as UnsplashOrientation | "")}
            className="shrink-0"
          >
            <ToggleGroupItem
              value="landscape"
              aria-label={t("unsplash.landscape")}
              className="px-2.5"
              title={t("unsplash.landscape")}
            >
              <RectangleHorizontal className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="portrait"
              aria-label={t("unsplash.portrait")}
              className="px-2.5"
              title={t("unsplash.portrait")}
            >
              <RectangleVertical className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="squarish"
              aria-label={t("unsplash.squarish")}
              className="px-2.5"
              title={t("unsplash.squarish")}
            >
              <Square className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Results grid */}
        <div className="overflow-y-auto flex-1 max-h-[55vh] pr-1 -mr-1">
          {showNoResults && (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              {t("unsplash.noResults")}
            </div>
          )}

          {hasPhotos && (
            <div className={cn("grid gap-3", gridCols)}>
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhoto?.id === photo.id}
                  onSelect={() => setSelectedPhoto(photo)}
                  aspectRatio={aspectRatio}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasPhotos && page < totalPages && (
            <div className="flex justify-center pt-4 pb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("unsplash.loadMore")}
              </Button>
            </div>
          )}

          {loading && !hasPhotos && (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
          <span className="text-xs text-muted-foreground">
            {t("unsplash.poweredBy")}{" "}
            <a
              href="https://unsplash.com/?utm_source=hubfy&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Unsplash
            </a>
          </span>

          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedPhoto || downloading}
          >
            {downloading && <Loader2 className="size-4 animate-spin mr-2" />}
            {downloading ? t("unsplash.downloading") : t("unsplash.usePhoto")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
