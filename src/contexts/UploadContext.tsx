import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type AssetType = Database["public"]["Enums"]["asset_type"];
type AssetStatus = Database["public"]["Enums"]["asset_status"];

export interface UploadItem {
  id: string;
  realAssetId?: string;
  title: string;
  type: AssetType;
  status: AssetStatus | "failed";
  progress: number;
  error?: string;
}

interface StartUploadOptions {
  /** Override the auto-derived title (filename without extension). */
  title?: string;
}

interface UploadContextValue {
  uploads: UploadItem[];
  /** Enqueue a file upload. Returns the tempId synchronously, or undefined if validation fails. */
  startUpload: (file: File, folderId?: string | null, options?: StartUploadOptions) => string | undefined;
  dismissUploads: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

// Limits
const MAX_VIDEO_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

function classifyFile(file: File): AssetType {
  return file.type.startsWith("video/") ? "video" : "file";
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  // beforeunload warning when uploads are active
  useEffect(() => {
    const hasActive = uploads.some((u) => u.status === "uploading" || u.status === "processing");
    if (!hasActive) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploads]);

  // Auto-remove completed/failed items after delay
  useEffect(() => {
    const done = uploads.filter((u) => u.status === "ready" || u.status === "failed");
    if (done.length === 0) return;

    const timeout = setTimeout(() => {
      setUploads((prev) =>
        prev.filter((u) => u.status !== "ready" && u.status !== "failed")
      );
    }, 4000);
    return () => clearTimeout(timeout);
  }, [uploads]);

  // ---------------------------------------------------------------------------
  // Realtime reconciliation: sync local uploads with DB asset status.
  //
  // For videos the local state stops at "processing" — only the Gumlet webhook
  // advances the DB row to ready/failed/deleted. This channel watches for those
  // transitions and mirrors them into the local uploads[] so that UploadToast,
  // beforeunload and useInlineAssetUpload all react correctly.
  // ---------------------------------------------------------------------------
  const trackedUploadsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    for (const u of uploads) {
      if (!u.realAssetId) continue;
      if (u.status === "uploading" || u.status === "processing") {
        map.set(u.realAssetId, u.id);
      }
    }
    trackedUploadsRef.current = map;
  }, [uploads]);

  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`upload-reconcile-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "assets",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status: AssetStatus } | null;
          if (!row?.id) return;

          const tempId = trackedUploadsRef.current.get(row.id);
          if (!tempId) return;

          setUploads((prev) =>
            prev.map((u) => {
              if (u.id !== tempId) return u;
              if (row.status === "ready") {
                return { ...u, status: "ready" as const, progress: 100 };
              }
              if (row.status === "failed") {
                return { ...u, status: "failed" as const, progress: 0, error: "Processing failed" };
              }
              if (row.status === "deleted") {
                return { ...u, status: "failed" as const, progress: 0, error: "Asset deleted" };
              }
              return u;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  // Async work — separated so startUpload stays synchronous
  const performUpload = useCallback(
    async (tempId: string, file: File, type: AssetType, title: string, folderId: string | null) => {
      const tenantId = tenant?.id;
      if (!tenantId) return;

      // Track the DB asset id locally so we can clean it up on failure even
      // before React state reflects it.
      let createdAssetId: string | null = null;

      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) throw new Error("No auth token");

        const endpoint = type === "video" ? "asset-upload-video" : "asset-upload-file";
        const body =
          type === "video"
            ? { tenant_id: tenantId, title, description: null, folder_id: folderId }
            : {
                tenant_id: tenantId,
                title,
                filename: file.name,
                mime_type: file.type,
                size_bytes: file.size,
                folder_id: folderId,
              };

        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Upload request failed");
        }

        const result = await res.json();
        createdAssetId = result.asset_id;

        // Store the real DB asset id for deduplication
        setUploads((prev) =>
          prev.map((u) => (u.id === tempId ? { ...u, realAssetId: result.asset_id } : u))
        );

        if (type === "file") {
          setUploads((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, progress: 50 } : u))
          );

          const uploadRes = await fetch(result.upload_url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadRes.ok) throw new Error("File upload failed");

          setUploads((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, progress: 80 } : u))
          );

          await fetch(
            `${SUPABASE_URL}/functions/v1/asset-confirm-upload`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ asset_id: result.asset_id }),
            }
          );

          setUploads((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, status: "ready", progress: 100 } : u))
          );
        } else {
          setUploads((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, progress: 30 } : u))
          );

          const uploadRes = await fetch(result.upload_url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadRes.ok) throw new Error("Video upload failed");

          setUploads((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, status: "processing", progress: 100 } : u))
          );

          // Confirm the upload so the DB asset moves uploading -> processing
          // immediately, without depending on the hosting webhook to fire.
          // If this call fails, we keep the local "processing" state — the
          // webhook or polling fallback may still rescue the asset.
          try {
            const confirmRes = await fetch(
              `${SUPABASE_URL}/functions/v1/asset-confirm-upload`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ asset_id: result.asset_id }),
              }
            );
            if (!confirmRes.ok) {
              console.error(
                "asset-confirm-upload returned non-ok for video",
                result.asset_id,
                confirmRes.status
              );
            }
          } catch (confirmErr) {
            console.error("asset-confirm-upload call failed:", confirmErr);
          }
        }

        // Invalidate queries so the asset list refreshes
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["assets", tenantId] });
          queryClient.invalidateQueries({ queryKey: ["asset_folders", tenantId] });
        }, 1500);
      } catch (err) {
        console.error("Upload error:", err);
        const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error(`Erro no upload de "${title}": ${errorMsg}`);

        // Mark as failed in the local upload list
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId ? { ...u, status: "failed" as const, progress: 0, error: errorMsg } : u
          )
        );

        // Clean up the DB asset if it was already created — prevents
        // orphan "uploading" records from lingering in the admin list.
        if (createdAssetId) {
          try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            if (token) {
              const deleteRes = await fetch(
                `${SUPABASE_URL}/functions/v1/asset-delete`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ asset_id: createdAssetId }),
                }
              );
              if (!deleteRes.ok) {
                console.error(
                  "asset-delete returned non-ok during cleanup",
                  createdAssetId,
                  deleteRes.status
                );
              }
              queryClient.invalidateQueries({ queryKey: ["assets", tenantId] });
            }
          } catch (cleanupErr) {
            console.error("Failed to cleanup orphan asset:", cleanupErr);
          }
        }
      }
    },
    [tenant?.id, queryClient]
  );

  // Synchronous enqueue — returns tempId immediately
  const startUpload = useCallback(
    (file: File, folderId?: string | null, options?: StartUploadOptions): string | undefined => {
      if (!tenant?.id) return undefined;

      const type = classifyFile(file);

      // Validate size
      const maxSize = type === "video" ? MAX_VIDEO_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
      if (file.size > maxSize) {
        const limit = type === "video" ? "5GB" : "200MB";
        toast.error(`"${file.name}" excede o limite de ${limit} (${formatSize(file.size)})`);
        return undefined;
      }

      const tempId = crypto.randomUUID();
      const title = options?.title ?? file.name.replace(/\.[^/.]+$/, "");

      setUploads((prev) => [
        { id: tempId, title, type, status: "uploading", progress: 0 },
        ...prev,
      ]);

      // Fire-and-forget async work
      performUpload(tempId, file, type, title, folderId ?? null);

      return tempId;
    },
    [tenant?.id, performUpload]
  );

  const dismissUploads = useCallback(() => {
    setUploads([]);
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, startUpload, dismissUploads }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploadContext() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploadContext must be used within UploadProvider");
  return ctx;
}
