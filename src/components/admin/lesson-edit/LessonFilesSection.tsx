import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Plus, X, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Database } from "@/integrations/supabase/types";

type AssetWithFile = Database["public"]["Tables"]["assets"]["Row"] & {
  asset_files: Database["public"]["Tables"]["asset_files"]["Row"] | null;
};

interface LessonFilesSectionProps {
  tenantId: string;
  linkedAssetIds: string[];
  onLinkedAssetIdsChange: (ids: string[]) => void;
}

export function LessonFilesSection({
  tenantId,
  linkedAssetIds,
  onLinkedAssetIdsChange,
}: LessonFilesSectionProps) {
  const { t } = useTranslation();
  const [availableAssets, setAvailableAssets] = useState<AssetWithFile[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Fetch available file assets (read-only, uses debounced search)
  useEffect(() => {
    const fetchAssets = async () => {
      setLoadingAssets(true);

      let query = supabase
        .from("assets")
        .select(`
          *,
          asset_files(*)
        `)
        .eq("tenant_id", tenantId)
        .eq("type", "file")
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (debouncedSearch.trim()) {
        query = query.ilike("title", `%${debouncedSearch.trim()}%`);
      }

      const { data, error } = await query;

      if (!error && data) {
        const formatted = data.map((a) => ({
          ...a,
          asset_files: Array.isArray(a.asset_files)
            ? a.asset_files[0] ?? null
            : a.asset_files,
        }));
        setAvailableAssets(formatted);
      }

      setLoadingAssets(false);
    };

    fetchAssets();
  }, [tenantId, debouncedSearch]);

  const handleAddFile = (asset: AssetWithFile) => {
    if (linkedAssetIds.includes(asset.id)) {
      toast.error(t("lessonEdit.files.alreadyLinked"));
      return;
    }
    onLinkedAssetIdsChange([...linkedAssetIds, asset.id]);
  };

  const handleRemoveFile = (assetId: string) => {
    onLinkedAssetIdsChange(linkedAssetIds.filter((id) => id !== assetId));
  };

  // Pinned fetch: always fetch linked files independently of gallery search/filter
  const [pinnedLinkedAssets, setPinnedLinkedAssets] = useState<AssetWithFile[]>([]);

  useEffect(() => {
    if (linkedAssetIds.length === 0) {
      setPinnedLinkedAssets([]);
      return;
    }

    let cancelled = false;

    const fetchLinked = async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, mime_type, asset_files(original_filename)")
        .in("id", linkedAssetIds)
        .eq("type", "file")
        .eq("status", "ready");

      if (cancelled || !data) return;

      const formatted = data.map((a) => ({
        ...a,
        asset_files: Array.isArray(a.asset_files)
          ? a.asset_files[0] ?? null
          : a.asset_files,
      }));

      // Preserve linkedAssetIds order
      const map = new Map(formatted.map((a) => [a.id, a]));
      setPinnedLinkedAssets(
        linkedAssetIds.map((id) => map.get(id)).filter(Boolean) as AssetWithFile[]
      );
    };

    fetchLinked();
    return () => { cancelled = true; };
  }, [linkedAssetIds]);

  // Filter out already linked assets from the gallery
  const linkedSet = new Set(linkedAssetIds);
  const unlinkedAssets = availableAssets.filter((a) => !linkedSet.has(a.id));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-section mb-2">{t("lessonEdit.files.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("lessonEdit.files.subtitle")}
        </p>
      </div>

      {/* Linked files */}
      {pinnedLinkedAssets.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t("lessonEdit.files.linked")}</h4>
          <div className="space-y-2">
            {pinnedLinkedAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border"
              >
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{asset.title}</p>
                  {asset.mime_type && (
                    <p className="text-xs text-muted-foreground">{asset.mime_type}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveFile(asset.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available files */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t("lessonEdit.files.addFiles")}</h4>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("lessonEdit.files.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* File list */}
        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
          {loadingAssets ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : unlinkedAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {availableAssets.length === 0
                  ? t("lessonEdit.files.noFiles")
                  : t("lessonEdit.files.allLinked")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {unlinkedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{asset.title}</p>
                    {asset.mime_type && (
                      <p className="text-xs text-muted-foreground">{asset.mime_type}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleAddFile(asset)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
