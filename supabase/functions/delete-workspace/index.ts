import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequest,
  authorizeWorkspace,
  toErrorResponse,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SupabaseAdminClient = ReturnType<typeof createClient>;

type StorageListItem = {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};


async function deleteGumletCollectionBestEffort(
  gumletWorkspaceId: string | null | undefined,
) {
  if (!gumletWorkspaceId) return;

  const gumletApiKey = Deno.env.get("GUMLET_API_KEY");
  if (!gumletApiKey) {
    console.warn("GUMLET_API_KEY not set, skipping Gumlet collection deletion");
    return;
  }

  try {
    const gumletRes = await fetch(
      `https://api.gumlet.com/v1/video/collections/${encodeURIComponent(gumletWorkspaceId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${gumletApiKey}`,
        },
      },
    );

    if (!gumletRes.ok && gumletRes.status !== 404) {
      const errorText = await gumletRes.text();
      console.warn(
        `Gumlet delete failed (${gumletRes.status}) for ${gumletWorkspaceId}: ${errorText}`,
      );
    }
  } catch (error) {
    console.warn("Gumlet collection deletion failed:", error);
  }
}

async function removeStoragePrefixBestEffort(
  supabaseAdmin: SupabaseAdminClient,
  bucket: "covers" | "assets",
  prefix: string,
) {
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  if (!normalizedPrefix) return;

  const foldersToVisit: string[] = [normalizedPrefix];
  const filesToDelete: string[] = [];
  const pageSize = 100;

  while (foldersToVisit.length > 0) {
    const currentFolder = foldersToVisit.shift();
    if (!currentFolder) continue;

    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(
        currentFolder,
        {
          limit: pageSize,
          offset,
          sortBy: { column: "name", order: "asc" },
        },
      );

      if (error) {
        console.warn(
          `Storage list failed for ${bucket}/${currentFolder}:`,
          error,
        );
        return;
      }

      const entries = (data ?? []) as StorageListItem[];
      if (entries.length === 0) break;

      for (const entry of entries) {
        const fullPath = `${currentFolder}/${entry.name}`;
        const isFile = Boolean(entry.id || entry.metadata);
        if (isFile) {
          filesToDelete.push(fullPath);
        } else {
          foldersToVisit.push(fullPath);
        }
      }

      if (entries.length < pageSize) break;
      offset += pageSize;
    }
  }

  if (filesToDelete.length === 0) return;

  for (let i = 0; i < filesToDelete.length; i += 100) {
    const batch = filesToDelete.slice(i, i + 100);
    const { error } = await supabaseAdmin.storage.from(bucket).remove(batch);

    if (error) {
      console.warn(`Storage remove failed for ${bucket}:`, error);
      return;
    }
  }
}

async function clearCallerDefaultWorkspaceBestEffort(
  supabaseAdmin: SupabaseAdminClient,
  callerId: string,
  tenantId: string,
) {
  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("preferences")
      .eq("user_id", callerId)
      .maybeSingle();

    if (profileError) {
      console.warn("Failed to load caller profile for preference cleanup:", profileError);
      return;
    }

    const currentPrefs = (profile?.preferences as Record<string, unknown> | null) ?? {};
    if (currentPrefs.default_workspace_id !== tenantId) {
      return;
    }

    const { default_workspace_id: _removed, ...rest } = currentPrefs;
    const { error: updatePrefError } = await supabaseAdmin
      .from("profiles")
      .update({ preferences: rest })
      .eq("user_id", callerId);

    if (updatePrefError) {
      console.warn("Failed to clear caller default_workspace_id:", updatePrefError);
    }
  } catch (error) {
    console.warn("Error cleaning caller preferences:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth (JWT-only, owner)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    // 2. Parse body
    const { tenant_id } = await req.json();

    if (!tenant_id || typeof tenant_id !== "string") {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }

    // 3. Authorize workspace (owner-only, JWT-only)
    const auth = await authorizeWorkspace(identity, tenant_id, supabaseAdmin, {
      minRole: "owner",
      jwtOnly: true,
    });

    const callerId = auth.userId;

    // 4. Fetch external cleanup metadata
    const [{ data: settings, error: settingsError }, { data: subscription, error: subError }] =
      await Promise.all([
        supabaseAdmin
          .from("tenant_settings")
          .select("gumlet_workspace_id")
          .eq("tenant_id", tenant_id)
          .maybeSingle(),
      ]);

    if (settingsError) throw settingsError;

    // 5. External cleanup (best-effort)
    await deleteGumletCollectionBestEffort(settings?.gumlet_workspace_id ?? null);
    await removeStoragePrefixBestEffort(
      supabaseAdmin,
      "covers",
      `products/${tenant_id}`,
    );
    await removeStoragePrefixBestEffort(
      supabaseAdmin,
      "assets",
      `tenant/${tenant_id}`,
    );

    // 6. Delete tenant (ON DELETE CASCADE handles related data)
    const { error: deleteTenantError } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenant_id);

    if (deleteTenantError) throw deleteTenantError;

    // 7. Clear caller preference (best-effort)
    await clearCallerDefaultWorkspaceBestEffort(
      supabaseAdmin,
      callerId,
      tenant_id,
    );

    return jsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("delete-workspace error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
