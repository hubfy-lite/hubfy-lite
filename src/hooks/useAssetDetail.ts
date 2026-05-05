import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Asset = Database["public"]["Tables"]["assets"]["Row"];
type AssetFile = Database["public"]["Tables"]["asset_files"]["Row"];
type AssetVideo = Database["public"]["Tables"]["asset_videos"]["Row"];

export type AssetWithDetails = Asset & {
  asset_files: AssetFile | null;
  asset_videos: AssetVideo | null;
};

export function useAssetDetail(assetId: string | undefined) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const {
    data: asset,
    isPending,
    error,
  } = useQuery({
    queryKey: ["asset-detail", assetId],
    queryFn: async (): Promise<AssetWithDetails | null> => {
      if (!assetId || !tenant?.id) return null;

      const { data, error } = await supabase
        .from("assets")
        .select("*, asset_files(*), asset_videos(*)")
        .eq("public_id", assetId)
        .eq("tenant_id", tenant.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        asset_files: Array.isArray(data.asset_files)
          ? data.asset_files[0] ?? null
          : data.asset_files,
        asset_videos: Array.isArray(data.asset_videos)
          ? data.asset_videos[0] ?? null
          : data.asset_videos,
      } as AssetWithDetails;
    },
    enabled: !!assetId && !!tenant?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      title,
      description,
    }: {
      title: string;
      description: string | null;
    }) => {
      if (!asset?.id) throw new Error("No asset ID");

      const { error } = await supabase
        .from("assets")
        .update({
          title: title.trim(),
          description: description?.trim() ?? null,
        })
        .eq("id", asset.id);

      if (error) throw error;
    },
    onSuccess: () => {
      // TODO: i18n
      toast.success("Arquivo atualizado!");
      queryClient.invalidateQueries({ queryKey: ["asset-detail", assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets", tenant?.id] });
    },
    onError: (err: Error) => {
      // TODO: i18n
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  const updateAsset = (title: string, description: string | null) => {
    updateMutation.mutate({ title, description });
  };

  return {
    asset: asset ?? null,
    isPending,
    error: error as Error | null,
    updateAsset,
    isUpdating: updateMutation.isPending,
  };
}
