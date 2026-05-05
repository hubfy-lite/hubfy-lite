import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUploadContext } from "@/contexts/UploadContext";
import type { DeliverableAssetOption } from "@/components/admin/ProductDeliverableFields";

export interface PendingAssetItem {
  tempId: string;
  title: string;
  progress: number;
}

function getUniqueTitle(baseTitle: string, existingTitles: string[]): string {
  const s = new Set(existingTitles);
  if (!s.has(baseTitle)) return baseTitle;
  let n = 1;
  while (s.has(`${baseTitle} (${n})`)) n++;
  return `${baseTitle} (${n})`;
}

interface UseInlineAssetUploadParams {
  assets: DeliverableAssetOption[];
  setAssets: React.Dispatch<React.SetStateAction<DeliverableAssetOption[]>>;
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  tenantId: string | undefined;
}

export function useInlineAssetUpload({
  assets,
  setAssets,
  selectedAssetIds,
  setSelectedAssetIds,
  tenantId,
}: UseInlineAssetUploadParams) {
  const { t } = useTranslation();
  const { uploads, startUpload } = useUploadContext();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Track tempIds originated from this hook instance
  const pendingTempIdsRef = useRef<Set<string>>(new Set());
  // Prevent duplicate handling
  const handledTempIdsRef = useRef<Set<string>>(new Set());

  const triggerUpload = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleUploadFile = useCallback(
    (file: File) => {
      if (selectedAssetIds.length >= 10) {
        toast.error(t("productSheet.maxAssets"));
        return;
      }

      const baseTitle = file.name.replace(/\.[^/.]+$/, "");
      const allExistingTitles = [
        ...assets.map((a) => a.title),
        ...uploads.filter((u) => u.status !== "failed").map((u) => u.title),
      ];
      const uniqueTitle = getUniqueTitle(baseTitle, allExistingTitles);

      const tempId = startUpload(file, null, { title: uniqueTitle });
      if (tempId) {
        pendingTempIdsRef.current.add(tempId);
      }
    },
    [assets, uploads, selectedAssetIds.length, startUpload, t]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      handleUploadFile(file);
    },
    [handleUploadFile]
  );

  // Watch uploads for completion — auto-select when ready
  useEffect(() => {
    for (const u of uploads) {
      if (
        u.status === "ready" &&
        u.realAssetId &&
        pendingTempIdsRef.current.has(u.id) &&
        !handledTempIdsRef.current.has(u.id)
      ) {
        handledTempIdsRef.current.add(u.id);
        pendingTempIdsRef.current.delete(u.id);

        const assetId = u.realAssetId;

        // Query the new asset by ID and merge locally (no full refetch / no spinner)
        supabase
          .from("assets")
          .select("id, title, mime_type, size_bytes")
          .eq("id", assetId)
          .single()
          .then(({ data }) => {
            if (data) {
              setAssets((prev) =>
                prev.some((a) => a.id === data.id) ? prev : [data, ...prev]
              );
              setSelectedAssetIds((prev) => {
                if (prev.includes(data.id) || prev.length >= 10) return prev;
                return [...prev, data.id];
              });
              toast.success(t("productSheet.uploadAutoSelected"));
            }
          });
      }
    }
  }, [uploads, setAssets, setSelectedAssetIds, t]);

  // Build pending items list for the UI (uploading items originated from this hook)
  const pendingItems: PendingAssetItem[] = uploads
    .filter(
      (u) =>
        pendingTempIdsRef.current.has(u.id) &&
        !handledTempIdsRef.current.has(u.id) &&
        u.status !== "failed"
    )
    .map((u) => ({
      tempId: u.id,
      title: u.title,
      progress: u.progress,
    }));

  return {
    handleUploadFile,
    pendingItems,
    uploadInputRef,
    triggerUpload,
    handleFileSelect,
  };
}
