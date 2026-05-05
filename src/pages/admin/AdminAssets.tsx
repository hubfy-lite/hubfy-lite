import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Upload,
  Download,
  FileText,
  Film,
  Loader2,
  Play,
  Trash2,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderInput,
  FolderMinus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayerModal } from "@/components/admin/VideoPlayerModal";
import { AssetDetailSheet } from "@/components/admin/AssetDetailSheet";
import { useAssets, type AssetWithDetails, type UploadingAsset } from "@/hooks/useAssets";
import { useFolders, type AssetFolder } from "@/hooks/useFolders";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { TFunction } from "i18next";

type AssetStatus = Database["public"]["Enums"]["asset_status"];

const FOLDER_COLORS = [
  { id: "red",    hex: "#FF453A" },
  { id: "orange", hex: "#FF9F0A" },
  { id: "yellow", hex: "#FFD60A" },
  { id: "green",  hex: "#30D158" },
  { id: "blue",   hex: "#0A84FF" },
  { id: "gray",   hex: "#8E8E93" },
] as const;

function getStatusConfig(t: TFunction): Record<AssetStatus, { label: string; description: string; variant: BadgeVariant }> {
  return {
    uploading: {
      label: t("assets.statusLabels.uploading"),
      description: t("assets.statusDescriptions.uploading"),
      variant: "amber",
    },
    processing: {
      label: t("assets.statusLabels.processing"),
      description: t("assets.statusDescriptions.processing"),
      variant: "blue",
    },
    ready: {
      label: t("assets.statusLabels.ready"),
      description: t("assets.statusDescriptions.ready"),
      variant: "green",
    },
    failed: {
      label: t("assets.statusLabels.failed"),
      description: t("assets.statusDescriptions.failed"),
      variant: "red",
    },
    deleted: {
      label: t("assets.statusLabels.deleted"),
      description: t("assets.statusDescriptions.deleted"),
      variant: "gray",
    },
  };
}

function StatusBadge({ status, progressPct }: { status: AssetStatus; progressPct?: number | null }) {
  const { t } = useTranslation();
  const statusCfg = getStatusConfig(t);
  const config = statusCfg[status] ?? {
    label: status ?? "—",
    description: "",
    variant: "gray" as BadgeVariant,
  };
  const showProgress = status === "processing" && typeof progressPct === "number";
  const label = showProgress ? `${config.label} ${progressPct}%` : config.label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={config.variant} className="cursor-help">
          {(status === "uploading" || status === "processing") && <Loader2 className="size-3 animate-spin" />}
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TypeIcon({ type }: { type: "video" | "file" }) {
  return type === "video" ? (
    <Film className="size-4 text-primary" />
  ) : (
    <FileText className="size-4 text-muted-foreground" />
  );
}


function isUploadingAsset(asset: AssetWithDetails | UploadingAsset): asset is UploadingAsset {
  return "progress" in asset;
}

interface ThumbnailProps {
  thumbnailUrl: string | null;
  title: string;
  onClick?: () => void;
  isClickable?: boolean;
  isVideo?: boolean;
  assetId: string;
  status: string;
  objectPath?: string | null;
  bucket?: string;
}

function AssetThumbnail({
  thumbnailUrl,
  title,
  onClick,
  isClickable,
  isVideo,
  assetId,
  status,
  objectPath,
  bucket = "assets",
}: ThumbnailProps) {
  const [hasError, setHasError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const FallbackIcon = isVideo ? Film : FileText;

  useEffect(() => {
    if (objectPath && !thumbnailUrl) {
      supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setSignedUrl(data.signedUrl);
        });
    }
  }, [objectPath, bucket, thumbnailUrl]);

  const effectiveUrl = thumbnailUrl || signedUrl;
  const showFallback = !effectiveUrl || hasError;

  if (showFallback) {
    if (isClickable && onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="w-16 h-10 rounded-lg bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer group"
        >
          <FallbackIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      );
    }
    return (
      <div className="w-16 h-10 rounded-lg bg-muted flex items-center justify-center">
        <FallbackIcon className="size-4 text-muted-foreground" />
      </div>
    );
  }

  if (isClickable && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative w-16 h-10 rounded-lg overflow-hidden group cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
      >
        <img
          src={effectiveUrl}
          alt={title}
          className="size-full object-cover"
          onError={() => setHasError(true)}
        />
        {isVideo && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="size-4 text-white fill-white" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="relative w-16 h-10 rounded-lg overflow-hidden">
      <img
        src={effectiveUrl}
        alt={title}
        className="size-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function isImageMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/");
}

// ─── Folder Sidebar ──────────────────────────────────────────────────────────

interface FolderSidebarProps {
  folders: AssetFolder[];
  isLoading: boolean;
  selectedFolderId: string | null | undefined;
  unfolderedCount: number;
  onSelectFolder: (id: string | null | undefined) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: AssetFolder) => void;
  onDeleteFolder: (folder: AssetFolder) => void;
  onChangeColor: (folder: AssetFolder, color: string) => void;
}

function FolderSidebar({
  folders,
  isLoading,
  selectedFolderId,
  unfolderedCount,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onChangeColor,
}: FolderSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="w-52 shrink-0 flex flex-col gap-1">
      {/* All files */}
      <button
        type="button"
        onClick={() => onSelectFolder(undefined)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full text-left",
          selectedFolderId === undefined
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <FolderOpen className="size-4 shrink-0" />
        <span className="truncate">{t("assets.folders.allFiles")}</span>
      </button>

      {/* Divider */}
      <div className="my-1 border-t border-border" />

      {/* Geral (sem pasta) */}
      <div className="group relative flex items-center">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full text-left pr-8",
            selectedFolderId === null
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Folder
            className="size-4 shrink-0"
            style={{ fill: "#8E8E93", color: "#8E8E93" }}
          />
          <span className="truncate">{t("assets.folders.root")}</span>
          {unfolderedCount > 0 && (
            <span className={cn(
              "ml-auto text-xs tabular-nums",
              selectedFolderId === null ? "text-primary/70" : "text-muted-foreground/60"
            )}>
              {unfolderedCount}
            </span>
          )}
        </button>

        {/* Cosmetic actions menu (disabled) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute right-1.5 size-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/15 transition-all"
            >
              <span className="sr-only">Ações</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-muted-foreground">
                <circle cx="7" cy="2.5" r="1.2" />
                <circle cx="7" cy="7" r="1.2" />
                <circle cx="7" cy="11.5" r="1.2" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {/* Color picker (decorativo) */}
            <div className="flex gap-1.5 px-2 py-2 opacity-30 pointer-events-none">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled
                  className="size-5 rounded-full"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="opacity-30 cursor-default">
              {t("assets.folders.rename")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="opacity-30 cursor-default text-destructive focus:text-destructive">
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Folder list */}
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))
      ) : (
        folders.map((folder) => (
          <div key={folder.id} className="group relative flex items-center">
            <button
              type="button"
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full text-left pr-8",
                selectedFolderId === folder.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Folder
                className="size-4 shrink-0"
                style={{
                  fill: FOLDER_COLORS.find((c) => c.id === folder.color)?.hex ?? "#8E8E93",
                  color: FOLDER_COLORS.find((c) => c.id === folder.color)?.hex ?? "#8E8E93",
                }}
              />
              <span className="truncate">{folder.name}</span>
              {typeof folder.asset_count === "number" && folder.asset_count > 0 && (
                <span className={cn(
                  "ml-auto text-xs tabular-nums",
                  selectedFolderId === folder.id ? "text-primary/70" : "text-muted-foreground/60"
                )}>
                  {folder.asset_count}
                </span>
              )}
            </button>

            {/* Folder actions (hover) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="absolute right-1.5 size-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/15 transition-all"
                >
                  <span className="sr-only">Ações</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-muted-foreground">
                    <circle cx="7" cy="2.5" r="1.2" />
                    <circle cx="7" cy="7" r="1.2" />
                    <circle cx="7" cy="11.5" r="1.2" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {/* Color picker */}
                <div className="flex gap-1.5 px-2 py-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onChangeColor(folder, c.id); }}
                      className={cn(
                        "size-5 rounded-full transition-all hover:scale-110",
                        folder.color === c.id && "ring-2 ring-offset-1 ring-foreground/60"
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRenameFolder(folder)}>
                  {t("assets.folders.rename")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteFolder(folder)}
                  className="text-destructive focus:text-destructive"
                >
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))
      )}

      {/* New folder button */}
      <div className="mt-2">
        <button
          type="button"
          onClick={onCreateFolder}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
        >
          <FolderPlus className="size-4 shrink-0" />
          {t("assets.folders.newFolder")}
        </button>
      </div>
    </div>
  );
}

// ─── Create / Rename Folder Dialog ───────────────────────────────────────────

interface FolderNameDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName?: string;
  mode: "create" | "rename";
  onConfirm: (name: string, color?: string) => Promise<void>;
  isPending: boolean;
}

function FolderNameDialog({ open, onOpenChange, initialName = "", mode, onConfirm, isPending }: FolderNameDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState("gray");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor("gray");
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onConfirm(name.trim(), mode === "create" ? color : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("assets.folders.createFolder") : t("assets.folders.renameFolderTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("assets.folders.folderName")}</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("assets.folders.folderNamePlaceholder")}
              maxLength={60}
            />
          </div>
          {mode === "create" && (
            <div className="flex gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={cn(
                    "size-7 rounded-full transition-all hover:scale-110",
                    color === c.id && "ring-2 ring-offset-2 ring-foreground/60"
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? t("assets.folders.createFolder") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Move to Folder Dialog ────────────────────────────────────────────────────

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders: AssetFolder[];
  currentFolderId: string | null;
  assetTitle: string;
  isMoving: boolean;
  onMove: (folderId: string | null, folderName?: string) => void;
}

function MoveToFolderDialog({ open, onOpenChange, folders, currentFolderId, assetTitle, isMoving, onMove }: MoveToFolderDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={isMoving ? undefined : onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("assets.folders.moveToFolder")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          <p className="text-sm text-muted-foreground mb-3">
            "{assetTitle.length > 40 ? assetTitle.slice(0, 40) + "…" : assetTitle}"
          </p>

          {/* No folder option */}
          <button
            type="button"
            disabled={isMoving || currentFolderId === null}
            onClick={() => onMove(null)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-colors outline-none",
              currentFolderId === null
                ? "bg-primary/10 text-primary font-medium cursor-default"
                : "hover:bg-muted text-muted-foreground disabled:opacity-50"
            )}
          >
            <FolderMinus className="size-4 shrink-0" />
            {t("assets.folders.noFolder")}
          </button>

          {/* Folders */}
          {folders.map((folder) => {
            const folderHex = FOLDER_COLORS.find((c) => c.id === folder.color)?.hex ?? "#8E8E93";
            const isCurrent = currentFolderId === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                disabled={isMoving || isCurrent}
                onClick={() => onMove(folder.id, folder.name)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-colors outline-none",
                  isCurrent
                    ? "bg-primary/10 text-primary font-medium cursor-default"
                    : "hover:bg-muted text-foreground disabled:opacity-50"
                )}
              >
                <Folder className="size-4 shrink-0" style={{ fill: folderHex, color: folderHex }} />
                {folder.name}
              </button>
            );
          })}

          {folders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("assets.folders.newFolder")} →
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Folder Dialog (double confirmation) ───────────────────────────────

interface DeleteFolderDialogProps {
  folder: AssetFolder | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (folderId: string) => Promise<void>;
  isDeleting: boolean;
}

function DeleteFolderDialog({ folder, onOpenChange, onConfirm, isDeleting }: DeleteFolderDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmName, setConfirmName] = useState("");

  const open = !!folder;
  const hasFiles = (folder?.asset_count ?? 0) > 0;
  const nameMatches = confirmName.trim() === folder?.name;

  // Reset when opening
  useEffect(() => {
    if (open) {
      setStep(1);
      setConfirmName("");
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleFirstConfirm = () => {
    if (!hasFiles) {
      // No files → go straight to delete
      onConfirm(folder!.id).then(() => onOpenChange(false));
    } else {
      setStep(2);
    }
  };

  const handleFinalConfirm = async () => {
    if (!nameMatches || !folder) return;
    await onConfirm(folder.id);
    onOpenChange(false);
  };

  if (!folder) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <AlertDialogContent>
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("assets.folders.deleteDialog.title", { name: folder.name })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {hasFiles
                  ? t("assets.folders.deleteDialog.descriptionWithFiles", { count: folder.asset_count })
                  : t("assets.folders.deleteDialog.descriptionEmpty")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFirstConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {hasFiles
                  ? t("assets.folders.deleteDialog.confirmButton")
                  : t("assets.folders.deleteDialog.confirmButtonEmpty")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("assets.folders.deleteDialog.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("assets.folders.deleteDialog.confirmDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-2">
              <Input
                autoFocus
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={t("assets.folders.deleteDialog.confirmPlaceholder", { name: folder.name })}
                onKeyDown={(e) => e.key === "Enter" && nameMatches && handleFinalConfirm()}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinalConfirm}
                disabled={!nameMatches || isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <><Loader2 className="size-4 animate-spin" />{t("common.deleting")}</>
                ) : (
                  <><Trash2 className="size-4" />{t("assets.folders.deleteDialog.confirmButton")}</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAssets() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { tenant } = useTenant();
  const isPro = tenant?.plan === "pro" || tenant?.plan === "business";
  const isMobile = useIsMobile();

  // Folder state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined);
  const {
    folders,
    isLoading: foldersLoading,
    createFolder,
    isCreating,
    renameFolder,
    isRenaming,
    deleteFolder,
    isDeleting: isDeletingFolder,
    moveAsset,
    isMoving,
    updateFolderColor,
    unfolderedCount,
  } = useFolders();

  const {
    assets,
    isLoading,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    uploadInputRef,
    triggerUpload,
    handleFileSelect,
    deleteAsset,
    isDeleting,
    updateAsset,
    isUpdating,
    page,
    setPage,
    totalCount,
    totalPages,
    pageSize,
  } = useAssets(selectedFolderId);

  // Asset modals
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{ gumletAssetId: string | null; title: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<{ id: string; title: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetWithDetails | null>(null);

  // Move to folder dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [assetToMove, setAssetToMove] = useState<AssetWithDetails | null>(null);

  // Folder dialogs
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AssetFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetFolder | null>(null);

  const handleDeleteClick = (asset: { id: string; title: string }) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (assetToDelete) {
      deleteAsset(assetToDelete.id);
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    }
  };

  const handleSortChange = (value: string) => {
    if (value === "title-asc") { setSortField("title"); setSortOrder("asc"); }
    else if (value === "title-desc") { setSortField("title"); setSortOrder("desc"); }
    else if (value === "created_at-desc") { setSortField("created_at"); setSortOrder("desc"); }
    else if (value === "created_at-asc") { setSortField("created_at"); setSortOrder("asc"); }
  };

  const currentSort = `${sortField}-${sortOrder}`;

  const handleOpenSheet = (asset: AssetWithDetails) => {
    setSelectedAsset(asset);
    setSheetOpen(true);
  };

  const handlePlayVideoFromSheet = (gumletAssetId: string, title: string) => {
    setSelectedVideo({ gumletAssetId, title });
    setVideoModalOpen(true);
  };

  const handleVideoClick = (asset: AssetWithDetails) => {
    if (asset.type === "video" && asset.asset_videos?.gumlet_asset_id) {
      setSelectedVideo({ gumletAssetId: asset.asset_videos.gumlet_asset_id, title: asset.title });
      setVideoModalOpen(true);
    }
  };

  const handleMoveClick = (asset: AssetWithDetails) => {
    setAssetToMove(asset);
    setMoveDialogOpen(true);
  };

  const selectedFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;

  return (
    <>
      {/* Hidden file input */}
      <input ref={uploadInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {/* Asset Detail Sheet */}
      <AssetDetailSheet
        asset={selectedAsset}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={updateAsset}
        isUpdating={isUpdating}
        onPlayVideo={handlePlayVideoFromSheet}
        videoSettings={tenant?.video_settings}
        fallbackColor={tenant?.icon_color ?? tenant?.primary_color}
        captionsEnabled={tenant?.plan === "pro" || tenant?.plan === "business"}
      />

      {/* Video Player Modal */}
      <VideoPlayerModal
        open={videoModalOpen}
        onOpenChange={setVideoModalOpen}
        gumletAssetId={selectedVideo?.gumletAssetId ?? null}
        title={selectedVideo?.title ?? ""}
        videoSettings={tenant?.video_settings}
        fallbackColor={tenant?.icon_color ?? tenant?.primary_color}
        captionsEnabled={tenant?.plan === "pro" || tenant?.plan === "business"}
      />

      {/* Delete Asset Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assets.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("assets.deleteDialog.description", { title: assetToDelete?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <><Loader2 className="size-4 animate-spin" />{t("common.deleting")}</>
              ) : (
                <><Trash2 className="size-4" />{t("common.delete")}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Folder dialogs */}
      <FolderNameDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        mode="create"
        onConfirm={async (name, color) => { await createFolder(name, color); }}
        isPending={isCreating}
      />

      <FolderNameDialog
        open={!!renameTarget}
        onOpenChange={(v) => !v && setRenameTarget(null)}
        mode="rename"
        initialName={renameTarget?.name ?? ""}
        onConfirm={async (name) => {
          if (renameTarget) renameFolder(renameTarget.id, name);
        }}
        isPending={isRenaming}
      />

      <DeleteFolderDialog
        folder={deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        onConfirm={async (folderId) => {
          await deleteFolder(folderId);
          // If we deleted the selected folder, go back to all
          if (selectedFolderId === folderId) setSelectedFolderId(undefined);
        }}
        isDeleting={isDeletingFolder}
      />

      {/* Move to folder dialog */}
      <MoveToFolderDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        folders={folders}
        currentFolderId={(assetToMove as AssetWithDetails & { folder_id?: string | null })?.folder_id ?? null}
        assetTitle={assetToMove?.title ?? ""}
        isMoving={isMoving}
        onMove={async (folderId, folderName) => {
          if (!assetToMove) return;
          await moveAsset(assetToMove.id, folderId, folderName);
          setMoveDialogOpen(false);
        }}
      />

      <div className="p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-[1200px] 3xl:max-w-[1600px] mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal text-foreground md:text-2xl">{t("assets.title")}</h1>
            <Button
              onClick={triggerUpload}
              size="sm"
              className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
            >
              <Upload className="size-3.5 md:size-4" />
              <span className="md:hidden">Upload</span>
              <span className="hidden md:inline">{t("assets.upload")}</span>
            </Button>
          </div>

          {/* Mobile folder selector */}
          {isMobile && (
            <div className="mb-4">
              <Select
                value={selectedFolderId === undefined ? "__all__" : selectedFolderId === null ? "__root__" : selectedFolderId}
                onValueChange={(v) => {
                  if (v === "__all__") setSelectedFolderId(undefined);
                  else if (v === "__root__") setSelectedFolderId(null);
                  else setSelectedFolderId(v);
                }}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <div className="flex items-center gap-2">
                    <Folder className="size-3.5 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("assets.folders.allFiles")}</SelectItem>
                  <SelectItem value="__root__">{t("assets.folders.root")} {unfolderedCount > 0 ? `(${unfolderedCount})` : ""}</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name} {folder.asset_count ? `(${folder.asset_count})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Layout: sidebar + content */}
          <div className="flex gap-6 items-start">

            {/* Folder Sidebar — desktop only */}
            <div className="hidden md:block">
              <FolderSidebar
                folders={folders}
                isLoading={foldersLoading}
                selectedFolderId={selectedFolderId}
                unfolderedCount={unfolderedCount}
                onSelectFolder={setSelectedFolderId}
                onCreateFolder={() => setCreateFolderOpen(true)}
                onRenameFolder={setRenameTarget}
                onDeleteFolder={setDeleteTarget}
                onChangeColor={(folder, color) => updateFolderColor(folder.id, color)}
              />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Folder breadcrumb */}
              {(selectedFolder || selectedFolderId === null) && (
                <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(undefined)}
                    className="hover:text-foreground transition-colors"
                  >
                    {t("assets.folders.allFiles")}
                  </button>
                  <span>/</span>
                  <span className="text-foreground font-medium">
                    {selectedFolderId === null ? t("assets.folders.root") : selectedFolder?.name}
                  </span>
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 mb-6">
                <div className="relative min-w-0 flex-1 max-w-none sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground md:size-4" />
                  <Input
                    placeholder={t("assets.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8 text-sm md:h-10 md:pl-9"
                  />
                </div>

                <div className="flex gap-3">
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => setTypeFilter(v as "all" | "video" | "file")}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-32 md:h-10">
                      <SelectValue placeholder={t("common.type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("assets.filterAll")}</SelectItem>
                      <SelectItem value="video">{t("assets.filterVideo")}</SelectItem>
                      <SelectItem value="file">{t("assets.filterFile")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={currentSort} onValueChange={handleSortChange}>
                    <SelectTrigger className="h-9 w-full sm:w-40 md:h-10">
                      <SelectValue placeholder="Ordenar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title-asc">{t("assets.sortNameAsc")}</SelectItem>
                      <SelectItem value="title-desc">{t("assets.sortNameDesc")}</SelectItem>
                      <SelectItem value="created_at-desc">{t("assets.sortNewest")}</SelectItem>
                      <SelectItem value="created_at-asc">{t("assets.sortOldest")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-auto">
                <div className="min-w-[800px]">
                <Table className="w-full text-xs md:text-sm">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="h-9 w-[80px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("assets.columns.preview")}</TableHead>
                      <TableHead className="h-9 w-[33%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("assets.columns.name")}</TableHead>
                      <TableHead className="h-9 w-[10%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("assets.columns.type")}</TableHead>
                      <TableHead className="h-9 w-[12%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("assets.columns.status")}</TableHead>
                      <TableHead className="h-9 w-[15%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("assets.columns.createdAt")}</TableHead>
                      <TableHead className="h-9 w-[8%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("assets.columns.download")}</TableHead>
                      <TableHead className="h-9 w-[5%] bg-card px-3 md:h-10 md:px-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="px-3 py-2.5 md:p-4"><Skeleton className="h-10 w-16 rounded" /></TableCell>
                          <TableCell className="px-3 py-2.5 md:p-4"><Skeleton className="h-5 w-48" /></TableCell>
                          <TableCell className="px-3 py-2.5 md:p-4"><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell className="px-3 py-2.5 md:p-4"><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell className="px-3 py-2.5 md:p-4"><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell className="px-3 py-2.5 md:p-4"><Skeleton className="h-5 w-8" /></TableCell>
                          <TableCell className="px-3 py-2.5 md:p-4"><Skeleton className="h-5 w-5" /></TableCell>
                        </TableRow>
                      ))
                    ) : assets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          {selectedFolder
                            ? t("assets.folders.emptyFolder")
                            : t("assets.emptyMessage")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      assets.map((asset) => {
                        const isUploading = isUploadingAsset(asset);
                        const assetWithDetails = asset as AssetWithDetails;

                        let thumbnailUrl: string | null = null;
                        if (!isUploading) {
                          if (asset.type === "video") {
                            thumbnailUrl = assetWithDetails.asset_videos?.thumbnail_url ?? null;
                          }
                        }

                        const imageObjectPath = !isUploading && asset.type === "file" && isImageMimeType(asset.mime_type)
                          ? assetWithDetails.asset_files?.object_path ?? null
                          : null;
                        const imageBucket = !isUploading && asset.type === "file"
                          ? assetWithDetails.asset_files?.bucket ?? "assets"
                          : "assets";

                        const canDownload =
                          !isUploading && asset.type === "file" && asset.status === "ready"
                            && !!assetWithDetails.asset_files?.object_path;

                        const isVideo = asset.type === "video";
                        const isVideoClickable = isVideo && asset.status === "ready" && !!assetWithDetails.asset_videos?.gumlet_asset_id;

                        return (
                          <TableRow key={asset.id} className={cn("border-border", isUploading && "opacity-70")}>
                            <TableCell className="px-3 py-2.5 md:p-4">
                              <AssetThumbnail
                                key={`thumb-${asset.id}`}
                                thumbnailUrl={thumbnailUrl}
                                title={asset.title}
                                isVideo={isVideo}
                                isClickable={isVideoClickable}
                                onClick={isVideoClickable ? () => handleVideoClick(assetWithDetails) : undefined}
                                assetId={asset.id}
                                status={asset.status}
                                objectPath={imageObjectPath}
                                bucket={imageBucket}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2.5 md:p-4">
                              <div className="flex items-center gap-2 md:gap-3">
                                <TypeIcon type={asset.type} />
                                <span className="text-xs font-medium truncate max-w-[280px] md:text-sm">
                                  {asset.title}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground md:p-4 md:text-sm">
                              {asset.type === "video" ? t("assets.typeLabels.video") : t("assets.typeLabels.file")}
                            </TableCell>
                            <TableCell className="px-3 py-2.5 md:p-4">
                              <StatusBadge
                                status={asset.status}
                                progressPct={!isUploading ? assetWithDetails.asset_videos?.progress_pct : undefined}
                              />
                              {isPro && isVideo && asset.status === "ready"
                                && assetWithDetails.asset_videos?.subtitles_status === "generating"
                                && (Date.now() - new Date(asset.created_at).getTime() < 30 * 60 * 1000) && (
                                <span className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                  <Loader2 className="size-2.5 animate-spin" />
                                  {t("assets.generatingSubtitles")}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2.5 text-[10px] text-muted-foreground md:p-4 md:text-xs">
                              {formatDateTime(asset.created_at, lang)}
                            </TableCell>
                            <TableCell className="px-3 py-2.5 md:p-4">
                              {canDownload ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const path = assetWithDetails.asset_files?.object_path;
                                    const bucket = assetWithDetails.asset_files?.bucket ?? "assets";
                                    if (!path) return;
                                    const filename = assetWithDetails.asset_files?.original_filename || assetWithDetails.title || "download";
                                    const { data, error } = await supabase.storage
                                      .from(bucket)
                                      .createSignedUrl(path, 3600, { download: filename });
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
                                  }}
                                  className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors"
                                >
                                  <Download className="size-4 text-muted-foreground" />
                                </button>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2.5 md:p-4">
                              <ActionsMenu
                                items={[
                                  {
                                    label: t("common.edit"),
                                    onClick: () => !isUploading && handleOpenSheet(assetWithDetails),
                                    disabled: isUploading,
                                  },
                                  {
                                    label: t("assets.folders.moveToFolder"),
                                    icon: <FolderInput className="size-3.5" />,
                                    onClick: () => !isUploading && handleMoveClick(assetWithDetails),
                                    disabled: isUploading || folders.length === 0,
                                  },
                                  {
                                    label: t("common.delete"),
                                    onClick: () => handleDeleteClick({ id: asset.id, title: asset.title }),
                                    destructive: true,
                                    disabled: isUploading,
                                  },
                                ]}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                </div>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount} arquivos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 0 || isLoading}
                    >
                      <ChevronLeft className="size-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1 || isLoading}
                    >
                      Próxima
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
