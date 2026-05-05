import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Film,
  FileIcon,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
import { useTenant } from "@/hooks/useTenant";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAssetDetail } from "@/hooks/useAssetDetail";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

/* ─── Helpers ─── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


/* ─── Status badge variant ─── */

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready":
      return "default";
    case "processing":
    case "uploading":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

/* ─── Main Page ─── */

export default function AdminAssetDetail() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { tenant } = useTenant();
  const { asset, isPending, updateAsset, isUpdating } = useAssetDetail(assetId);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Set page title
  usePageTitle(asset?.title);

  // Init form from asset
  useEffect(() => {
    if (!asset) return;
    setTitle(asset.title);
    setDescription(asset.description ?? "");
  }, [asset]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!asset) return false;
    return (
      title !== asset.title ||
      description !== (asset.description ?? "")
    );
  }, [asset, title, description]);

  const handleSave = () => {
    if (!title.trim()) {
      // TODO: i18n
      toast.error("O título é obrigatório");
      return;
    }
    updateAsset(title, description.trim() || null);
  };

  const handleCopyId = () => {
    if (!asset?.id) return;
    navigator.clipboard.writeText(asset.id);
    // TODO: i18n
    toast.success("ID copiado!");
  };

  /* ─── Loading ─── */
  if (isPending) {
    return (
      <>
        <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-10">
          <div className="mx-auto flex h-full min-w-[800px] max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </>
    );
  }

  /* ─── Not found ─── */
  if (!asset) {
    return (
      <>
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-3">
            {/* TODO: i18n */}
            <p className="text-muted-foreground">Arquivo não encontrado</p>
            <Button variant="outline" onClick={() => navigate("/admin/assets")}>
              <ArrowLeft className="size-4" />
              {/* TODO: i18n */}
              Voltar para Arquivos
            </Button>
          </div>
        </div>
      </>
    );
  }

  /* ─── Derived metadata ─── */
  const file = asset.asset_files;
  const video = asset.asset_videos;

  const mimeType = file?.mime_type ?? (asset.type === "video" ? "video/*" : "—");
  const fileSize = file?.size_bytes
    ? formatBytes(file.size_bytes)
    : null;
  const resolution =
    video?.width && video?.height ? `${video.width} × ${video.height}` : null;
  const duration =
    video?.duration_seconds != null ? formatDuration(video.duration_seconds) : null;

  return (
    <>
      <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex h-full min-w-[800px] max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0"
              onClick={() => navigate("/admin/assets")}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <h1 className="text-title min-w-0 truncate">{asset.title}</h1>
            <Badge variant="secondary" className="shrink-0">
              {asset.type === "video" ? (
                <Film className="size-3 mr-1" />
              ) : (
                <FileIcon className="size-3 mr-1" />
              )}
              {/* TODO: i18n */}
              {asset.type === "video" ? "Vídeo" : "Arquivo"}
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="info">
            <TabsList variant="line" className="shrink-0 border-b border-border w-full justify-start">
              {/* TODO: i18n */}
              <TabsTrigger value="info">Informações</TabsTrigger>
            </TabsList>

            {/* ─── Tab: Info ─── */}
            <TabsContent value="info" className="mt-8 space-y-8">
              {/* Title */}
              <Field orientation="split">
                <FieldContent>
                  {/* TODO: i18n */}
                  <FieldLabel>Título</FieldLabel>
                  <FieldDescription>Nome de exibição do arquivo</FieldDescription>
                </FieldContent>
                <FieldControl>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nome do arquivo"
                  />
                </FieldControl>
              </Field>

              {/* Description */}
              <Field orientation="split">
                <FieldContent>
                  {/* TODO: i18n */}
                  <FieldLabel>Descrição</FieldLabel>
                  <FieldDescription>Descrição opcional para organização interna</FieldDescription>
                </FieldContent>
                <FieldControl>
                  <Textarea
                    {...NO_AUTOFILL_PROPS}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Adicione uma descrição..."
                    rows={3}
                  />
                </FieldControl>
              </Field>

              {/* Save button */}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={isUpdating || !isDirty}>
                  {isUpdating && <Loader2 className="size-4 animate-spin" />}
                  {/* TODO: i18n */}
                  Salvar
                </Button>
              </div>

              <FieldSeparator />

              {/* Read-only metadata */}

              {/* Type */}
              <Field orientation="split">
                <FieldContent>
                  {/* TODO: i18n */}
                  <FieldLabel>Tipo</FieldLabel>
                </FieldContent>
                <FieldControl>
                  <p className="text-sm text-foreground">
                    {asset.type === "video" ? "Vídeo" : "Arquivo"}
                  </p>
                </FieldControl>
              </Field>

              {/* Status */}
              <Field orientation="split">
                <FieldContent>
                  {/* TODO: i18n */}
                  <FieldLabel>Status</FieldLabel>
                </FieldContent>
                <FieldControl>
                  <Badge variant={getStatusVariant(asset.status)}>
                    {asset.status}
                  </Badge>
                </FieldControl>
              </Field>

              {/* MIME type */}
              <Field orientation="split">
                <FieldContent>
                  {/* TODO: i18n */}
                  <FieldLabel>Tipo MIME</FieldLabel>
                </FieldContent>
                <FieldControl>
                  <p className="text-sm text-muted-foreground">{mimeType}</p>
                </FieldControl>
              </Field>

              {/* File size */}
              {fileSize && (
                <Field orientation="split">
                  <FieldContent>
                    {/* TODO: i18n */}
                    <FieldLabel>Tamanho</FieldLabel>
                  </FieldContent>
                  <FieldControl>
                    <p className="text-sm text-muted-foreground">{fileSize}</p>
                  </FieldControl>
                </Field>
              )}

              {/* Resolution (videos only) */}
              {resolution && (
                <Field orientation="split">
                  <FieldContent>
                    {/* TODO: i18n */}
                    <FieldLabel>Resolução</FieldLabel>
                  </FieldContent>
                  <FieldControl>
                    <p className="text-sm text-muted-foreground">{resolution}</p>
                  </FieldControl>
                </Field>
              )}

              {/* Duration (videos only) */}
              {duration && (
                <Field orientation="split">
                  <FieldContent>
                    {/* TODO: i18n */}
                    <FieldLabel>Duração</FieldLabel>
                  </FieldContent>
                  <FieldControl>
                    <p className="text-sm text-muted-foreground">{duration}</p>
                  </FieldControl>
                </Field>
              )}

              {/* Created date */}
              <Field orientation="split">
                <FieldContent>
                  {/* TODO: i18n */}
                  <FieldLabel>Criado em</FieldLabel>
                </FieldContent>
                <FieldControl>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(asset.created_at, lang)}
                  </p>
                </FieldControl>
              </Field>

              {/* ID — copyable */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel>ID</FieldLabel>
                </FieldContent>
                <FieldControl>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span className="text-xs">{asset.id}</span>
                    <Copy className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </FieldControl>
              </Field>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
