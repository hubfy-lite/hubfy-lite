import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gumletApiKey = Deno.env.get("GUMLET_API_KEY");

    // ── 1. Admin client ──
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ── 2. Authenticate (who are you?) ──
    const identity = await authenticateRequest(req, admin);

    // ── 3. Parse body ──
    const { asset_id } = await req.json();
    if (!asset_id) {
      return new Response(JSON.stringify({ error: "asset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Load resource to discover tenant_id ──
    const { data: asset, error: assetError } = await admin
      .from("assets")
      .select(`
        *,
        asset_videos(gumlet_asset_id),
        asset_files(bucket, object_path)
      `)
      .eq("id", asset_id)
      .single();

    if (assetError || !asset) {
      console.error("Asset not found:", assetError);
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Authorize workspace ──
    await authorizeWorkspace(identity, asset.tenant_id, admin, { minRole: "editor" });

    console.log(`Deleting asset ${asset_id}, type: ${asset.type}`);

    // ── 6. Delete from external services based on type ──
    if (asset.type === "video" && asset.asset_videos?.gumlet_asset_id) {
      const gumletAssetId = asset.asset_videos.gumlet_asset_id;

      if (gumletApiKey) {
        try {
          console.log(`Deleting video from Gumlet: ${gumletAssetId}`);
          const gumletRes = await fetch(
            `https://api.gumlet.com/v1/video/assets/${gumletAssetId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${gumletApiKey}`,
              },
            }
          );

          if (!gumletRes.ok && gumletRes.status !== 404) {
            const errorText = await gumletRes.text();
            console.error(`Gumlet delete failed: ${gumletRes.status} - ${errorText}`);
            // Continue with DB deletion even if Gumlet fails
          } else {
            console.log("Gumlet asset deleted successfully");
          }
        } catch (gumletError) {
          console.error("Error calling Gumlet API:", gumletError);
          // Continue with DB deletion
        }
      } else {
        console.warn("GUMLET_API_KEY not set, skipping Gumlet deletion");
      }
    } else if (asset.type === "file" && asset.asset_files) {
      // Delete file from storage
      const { bucket, object_path } = asset.asset_files;
      try {
        console.log(`Deleting file from storage: ${bucket}/${object_path}`);
        const { error: storageError } = await admin.storage
          .from(bucket)
          .remove([object_path]);

        if (storageError) {
          console.error("Storage delete error:", storageError);
          // Continue with DB deletion
        } else {
          console.log("Storage file deleted successfully");
        }
      } catch (storageError) {
        console.error("Error deleting from storage:", storageError);
        // Continue with DB deletion
      }
    }

    // ── 7. Soft delete - update status to 'deleted' ──
    const { error: updateError } = await admin
      .from("assets")
      .update({ status: "deleted" })
      .eq("id", asset_id);

    if (updateError) {
      console.error("Failed to update asset status:", updateError);
      return new Response(JSON.stringify({ error: "Failed to delete asset" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Asset ${asset_id} marked as deleted`);

    return new Response(
      JSON.stringify({ success: true, asset_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("asset-delete error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
