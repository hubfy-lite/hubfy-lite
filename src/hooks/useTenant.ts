import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";
import { invalidateTenantVisuals } from "@/lib/query-invalidation";
import type { Database } from "@/integrations/supabase/types";
import type { VideoSettings } from "@/lib/video-settings";

type TenantsRow = Database["public"]["Tables"]["tenants"]["Row"];
type SettingsRow = Database["public"]["Tables"]["tenant_settings"]["Row"];

/** Flattened tenant + tenant_settings with typed JSON overrides */
export type Tenant = Omit<TenantsRow, "updated_at"> &
  Omit<SettingsRow, "tenant_id" | "video_settings" | "social_links"> & {
    social_links: Record<string, string> | null;
    video_settings: VideoSettings | null;
  };

export interface UserPreferences {
  default_workspace_id?: string | null;
  [key: string]: unknown;
}

interface UserWorkspace {
  id: string;
  name: string;
  [key: string]: unknown;
}

// Campos que vivem na tabela "tenants"
const TENANTS_FIELDS = new Set(["name", "slug"]);

/** Fetch tenant + tenant_settings via JOIN and flatten into a single Tenant object */
async function fetchTenantById(tenantId: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*, tenant_settings(*)")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Flatten: merge tenant identity + settings into a single object
  // Exclude public_id from settings so the tenant's own public_id wins
  const { tenant_settings, ...tenantFields } = data as any;
  const { public_id: _, ...settingsFields } = tenant_settings ?? {};
  return { ...tenantFields, ...settingsFields } as Tenant;
}

export function useTenant() {
  const { user, profile, profileLoading } = useAuth();
  const queryClient = useQueryClient();
  // Wait for profile hydration so we don't resolve tenant from stale fallback.
  const enabled = !!user && !profileLoading;
  const defaultWorkspaceId = (profile?.preferences as UserPreferences | null)?.default_workspace_id ?? null;
  const queryKey = ["tenant", user?.id, defaultWorkspaceId ?? "no-default"];

  const fetchTenant = useCallback(async () => {
    if (!user) return null;

    // 1. Prioritize user preference (default_workspace_id) if set
    if (defaultWorkspaceId) {
      // Verify user still has access to this workspace
      const { data: hasAccess } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("tenant_id", defaultWorkspaceId)
        .maybeSingle();

      if (hasAccess) {
        const tenant = await fetchTenantById(defaultWorkspaceId);
        if (tenant) return tenant;
      }
    }

    // 2. Fallback: first tenant_users membership
    const { data: membership, error: membershipError } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership?.tenant_id) return null;

    return fetchTenantById(membership.tenant_id);
  }, [user, defaultWorkspaceId]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchTenant,
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 300,
  });

  const updateTenant = async (updates: Partial<Omit<Tenant, "id" | "created_by" | "created_at" | "updated_at">>) => {
    if (!data) throw new Error("No tenant found");

    // Split updates: "tenants" fields vs "tenant_settings" fields
    const tenantsUpdates: Record<string, unknown> = {};
    const settingsUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (TENANTS_FIELDS.has(key)) {
        tenantsUpdates[key] = value;
      } else {
        settingsUpdates[key] = value;
      }
    }

    const attemptUpdate = async (): Promise<Tenant | null> => {
      // Run both UPDATEs in parallel, each returning the updated row
      // via .select().single() so we don't need a follow-up SELECT.
      const [tenantsResult, settingsResult] = await Promise.all([
        Object.keys(tenantsUpdates).length > 0
          ? supabase
              .from("tenants")
              .update(tenantsUpdates)
              .eq("id", data.id)
              .select("*")
              .single()
          : Promise.resolve(null),
        Object.keys(settingsUpdates).length > 0
          ? supabase
              .from("tenant_settings")
              .update(settingsUpdates)
              .eq("tenant_id", data.id)
              .select("*")
              .single()
          : Promise.resolve(null),
      ]);

      if (tenantsResult?.error) throw tenantsResult.error;
      if (settingsResult?.error) throw settingsResult.error;

      // Merge the new values onto the cached tenant. Both rows include the
      // columns they own; settings.public_id is dropped so tenants.public_id wins.
      const newTenants = tenantsResult?.data ?? null;
      const newSettings = settingsResult?.data
        ? (() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { tenant_id, public_id, ...rest } = settingsResult.data as Record<string, unknown>;
            return rest;
          })()
        : null;

      return {
        ...data,
        ...(newTenants ?? {}),
        ...(newSettings ?? {}),
      } as Tenant;
    };

    let updatedData: Tenant | null = null;
    try {
      updatedData = await attemptUpdate();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message.includes("AbortError")) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        updatedData = await attemptUpdate();
      } else {
        throw error;
      }
    }

    queryClient.setQueryData(queryKey, updatedData);

    // Only sync sidebar/footer caches when something visual actually changed.
    // Saving unrelated config (video player, marketing, etc.) doesn't need to
    // touch user-workspaces or portal-tenant-footer queries.
    const visualChanged =
      "name" in updates ||
      "icon_name" in updates ||
      "icon_color" in updates ||
      "icon_url" in updates;

    if (updatedData && visualChanged) {
      queryClient.setQueriesData<UserWorkspace[]>(
        { queryKey: ["user-workspaces"] },
        (old) =>
          old?.map((ws) =>
            ws.id === updatedData.id
              ? { ...ws, name: updatedData.name, iconName: updatedData.icon_name, iconColor: updatedData.icon_color }
              : ws
          ),
      );
      // Invalidate portal/footer views that show tenant branding
      invalidateTenantVisuals(queryClient);
    }

    return updatedData as Tenant;
  };

  return {
    tenant: enabled ? (data ?? null) : null,
    loading: user ? (profileLoading || isLoading) : false,
    isFetching,
    error: error as Error | null,
    refetch,
    updateTenant,
  };
}
