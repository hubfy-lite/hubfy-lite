import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORPHAN_THRESHOLD_HOURS = 2;

interface AssetFile {
  bucket: string;
  object_path: string;
}

interface AssetVideo {
  gumlet_asset_id: string;
}

interface OrphanAsset {
  id: string;
  type: string;
  tenant_id: string;
  asset_files: AssetFile[];
  asset_videos: AssetVideo[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate authorization — only service role key allowed
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const gumletApiKey = Deno.env.get("GUMLET_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Find orphaned assets — no activity (updated_at) for ORPHAN_THRESHOLD_HOURS
    const cutoff = new Date(
      Date.now() - ORPHAN_THRESHOLD_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: orphans, error: queryError } = await supabase
      .from("assets")
      .select(`
        id, type, tenant_id,
        asset_files(bucket, object_path),
        asset_videos(gumlet_asset_id)
      `)
      .in("status", ["uploading", "processing"])
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(100);

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query orphans", detail: queryError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const typedOrphans = (orphans ?? []) as OrphanAsset[];

    if (typedOrphans.length === 0) {
      console.log("No orphaned assets found");
      return new Response(
        JSON.stringify({ cleaned: 0, skipped: 0, errors: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${typedOrphans.length} orphaned assets to clean up`);

    // 2. Clean up external resources per asset, track successes and failures separately
    const succeeded: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const asset of typedOrphans) {
      try {
        let externalCleanupOk = true;

        if (asset.type === "video") {
          const video = asset.asset_videos[0];
          if (video?.gumlet_asset_id && gumletApiKey) {
            const res = await fetch(
              `https://api.gumlet.com/v1/video/assets/${video.gumlet_asset_id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${gumletApiKey}` },
              }
            );
            if (!res.ok && res.status !== 404) {
              const text = await res.text();
              errors.push(`Gumlet delete failed for ${asset.id}: ${res.status} ${text}`);
              externalCleanupOk = false;
            }
          }
        } else if (asset.type === "file") {
          const file = asset.asset_files[0];
          if (file?.bucket && file?.object_path) {
            const { error: storageErr } = await supabase.storage
              .from(file.bucket)
              .remove([file.object_path]);
            if (storageErr) {
              errors.push(`Storage delete failed for ${asset.id}: ${storageErr.message}`);
              externalCleanupOk = false;
            }
          }
        }

        if (externalCleanupOk) {
          succeeded.push(asset.id);
        } else {
          skipped.push(asset.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`External cleanup failed for ${asset.id}: ${message}`);
        skipped.push(asset.id);
      }
    }

    // 3. Soft-delete ONLY assets whose external cleanup succeeded
    let cleaned = 0;
    if (succeeded.length > 0) {
      const { error: updateError } = await supabase
        .from("assets")
        .update({ status: "deleted" })
        .in("id", succeeded);

      if (updateError) {
        console.error("Failed to soft-delete orphans:", updateError);
        errors.push(`DB update failed: ${updateError.message}`);
      } else {
        cleaned = succeeded.length;
      }
    }

    console.log(
      `Cleanup complete: ${cleaned} deleted, ${skipped.length} skipped, ${errors.length} errors`
    );

    return new Response(
      JSON.stringify({
        cleaned,
        skipped: skipped.length,
        cleaned_ids: succeeded,
        skipped_ids: skipped,
        errors,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("asset-cleanup-orphans error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
