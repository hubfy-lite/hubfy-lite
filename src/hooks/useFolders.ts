import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface AssetFolder {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: string;
  asset_count?: number;
}

export function useFolders() {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const queryKey = ["asset_folders", tenant?.id];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<{ folders: AssetFolder[]; unfolderedCount: number }> => {
      if (!tenant?.id) return { folders: [], unfolderedCount: 0 };

      // Fetch folders
      const { data: foldersData, error: foldersError } = await supabase
        .from("asset_folders")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("name", { ascending: true });

      if (foldersError) throw foldersError;

      // Fetch all non-deleted assets' folder_ids (including null) in one query
      const { data: assetRows, error: countError } = await supabase
        .from("assets")
        .select("folder_id")
        .eq("tenant_id", tenant.id)
        .neq("status", "deleted");

      if (countError) throw countError;

      // Build count map client-side
      const countMap = (assetRows ?? []).reduce<Record<string, number>>((acc, a) => {
        if (a.folder_id) acc[a.folder_id] = (acc[a.folder_id] ?? 0) + 1;
        return acc;
      }, {});

      // Count assets without folder
      const unfolderedCount = (assetRows ?? []).filter((a) => !a.folder_id).length;

      const folders = (foldersData ?? []).map((f) => ({
        id: f.id,
        tenant_id: f.tenant_id,
        name: f.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        color: (f as any).color ?? "gray",
        created_at: f.created_at,
        asset_count: countMap[f.id] ?? 0,
      }));

      return { folders, unfolderedCount };
    },
    enabled: !!tenant?.id,
    staleTime: 0,
  });

  const folders = data?.folders ?? [];
  const unfolderedCount = data?.unfolderedCount ?? 0;

  // Create
  const createMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("asset_folders")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ tenant_id: tenant.id, name: name.trim(), color } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      const isDuplicate = error.message.includes("unique") || error.message.includes("duplicate");
      toast.error(isDuplicate ? "Já existe uma pasta com esse nome" : `Erro ao criar pasta: ${error.message}`);
    },
  });

  // Rename
  const renameMutation = useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      const { error } = await supabase
        .from("asset_folders")
        .update({ name: name.trim() })
        .eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta renomeada");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      const isDuplicate = error.message.includes("unique") || error.message.includes("duplicate");
      toast.error(isDuplicate ? "Já existe uma pasta com esse nome" : `Erro ao renomear: ${error.message}`);
    },
  });

  // Delete folder (and all assets inside it)
  const deleteMutation = useMutation({
    mutationFn: async (folderId: string) => {
      if (!tenant?.id) throw new Error("No tenant");

      // 1. Get all assets inside the folder
      const { data: assetsInFolder, error: fetchError } = await supabase
        .from("assets")
        .select("id")
        .eq("folder_id", folderId)
        .neq("status", "deleted");

      if (fetchError) throw fetchError;

      // 2. Delete each asset via edge function (handles Storage + Gumlet cleanup)
      if (assetsInFolder && assetsInFolder.length > 0) {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) throw new Error("No auth token");

        await Promise.all(
          assetsInFolder.map((asset) =>
            fetch(
              `${SUPABASE_URL}/functions/v1/asset-delete`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ asset_id: asset.id }),
              }
            )
          )
        );
      }

      // 3. Delete the folder
      const { error: deleteError } = await supabase
        .from("asset_folders")
        .delete()
        .eq("id", folderId);

      if (deleteError) throw deleteError;

      return assetsInFolder?.length ?? 0;
    },
    onSuccess: (deletedCount) => {
      toast.success(
        deletedCount > 0
          ? `Pasta e ${deletedCount} arquivo${deletedCount !== 1 ? "s" : ""} deletados`
          : "Pasta deletada"
      );
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["assets", tenant?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao deletar pasta: ${error.message}`);
    },
  });

  // Move asset to folder (or remove from folder)
  const moveAssetMutation = useMutation({
    mutationFn: async ({ assetId, folderId }: { assetId: string; folderId: string | null; folderName?: string }) => {
      const { error } = await supabase
        .from("assets")
        .update({ folder_id: folderId })
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: (_data, { folderId, folderName }) => {
      toast.success(folderId ? `Arquivo movido para "${folderName}"` : "Arquivo removido da pasta");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["assets", tenant?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao mover arquivo: ${error.message}`);
    },
  });

  // Update color (optimistic)
  const updateColorMutation = useMutation({
    mutationFn: async ({ folderId, color }: { folderId: string; color: string }) => {
      const { error } = await supabase
        .from("asset_folders")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ color } as any)
        .eq("id", folderId);
      if (error) throw error;
    },
    onMutate: async ({ folderId, color }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ folders: AssetFolder[]; unfolderedCount: number }>(queryKey);
      queryClient.setQueryData<{ folders: AssetFolder[]; unfolderedCount: number }>(queryKey, (old) => {
        if (!old) return { folders: [], unfolderedCount: 0 };
        return {
          ...old,
          folders: old.folders.map((f) => (f.id === folderId ? { ...f, color } : f)),
        };
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(t("folders.colorError"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const createFolder = useCallback(
    (name: string, color = "gray") => createMutation.mutateAsync({ name, color }),
    [createMutation]
  );

  const renameFolder = useCallback(
    (folderId: string, name: string) => renameMutation.mutate({ folderId, name }),
    [renameMutation]
  );

  const deleteFolder = useCallback(
    (folderId: string) => deleteMutation.mutateAsync(folderId),
    [deleteMutation]
  );

  const moveAsset = useCallback(
    (assetId: string, folderId: string | null, folderName?: string) =>
      moveAssetMutation.mutateAsync({ assetId, folderId, folderName }),
    [moveAssetMutation]
  );

  const updateFolderColor = useCallback(
    (folderId: string, color: string) => updateColorMutation.mutate({ folderId, color }),
    [updateColorMutation]
  );

  return {
    folders,
    isLoading,
    createFolder,
    isCreating: createMutation.isPending,
    renameFolder,
    isRenaming: renameMutation.isPending,
    deleteFolder,
    isDeleting: deleteMutation.isPending,
    moveAsset,
    isMoving: moveAssetMutation.isPending,
    updateFolderColor,
    unfolderedCount,
  };
}
