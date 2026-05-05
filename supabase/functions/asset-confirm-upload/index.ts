import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ConfirmUploadRequest = {
  asset_id: string;
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

    // ── 1. Admin client ──
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ── 2. Authenticate (who are you?) ──
    const identity = await authenticateRequest(req, admin);

    // ── 3. Parse request ──
    const body = (await req.json()) as ConfirmUploadRequest;
    if (!body?.asset_id) {
      return new Response(JSON.stringify({ error: "asset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Load resource to discover tenant_id ──
    const { data: assetData, error: assetError } = await admin
      .from("assets")
      .select("id, tenant_id, type, status")
      .eq("id", body.asset_id)
      .single();

    if (assetError || !assetData) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Authorize workspace ──
    await authorizeWorkspace(identity, assetData.tenant_id, admin, { minRole: "editor" });

    // ── 6. Video path: idempotent uploading -> processing transition ──
    // Videos live in Gumlet (not in Supabase Storage), so we just promote
    // the status. The Gumlet webhook + polling will eventually move it to
    // ready/failed. Idempotent: terminal states return success without
    // changing anything.
    if (assetData.type === "video") {
      if (assetData.status === "uploading") {
        const { error: updateError } = await admin
          .from("assets")
          .update({ status: "processing" })
          .eq("id", body.asset_id);

        if (updateError) {
          console.error("Failed to promote video to processing:", updateError);
          return new Response(JSON.stringify({ error: "Failed to update asset" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ success: true, asset_id: body.asset_id, status: "processing" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Already processing/ready/failed/deleted — no-op success
      return new Response(
        JSON.stringify({ success: true, asset_id: body.asset_id, status: assetData.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 7. File path (existing behavior) ──
    if (assetData.type !== "file") {
      return new Response(
        JSON.stringify({ error: "Unsupported asset type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (assetData.status !== "uploading") {
      return new Response(
        JSON.stringify({ error: "Asset is not in uploading status", current_status: assetData.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 8. Verify file exists in storage ──
    const { data: fileData, error: fileError } = await admin
      .from("asset_files")
      .select("bucket, object_path")
      .eq("asset_id", body.asset_id)
      .maybeSingle();

    if (fileError || !fileData) {
      return new Response(JSON.stringify({ error: "File record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if file exists in storage
    const { data: storageList, error: storageError } = await admin.storage
      .from(fileData.bucket)
      .list(fileData.object_path.split("/").slice(0, -1).join("/"), {
        search: fileData.object_path.split("/").pop(),
      });

    if (storageError || !storageList?.length) {
      return new Response(
        JSON.stringify({ error: "File not found in storage. Upload may have failed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 8. Get file metadata and generate public URL ──
    const fileInfo = storageList[0];
    const { data: publicUrlData } = admin.storage
      .from(fileData.bucket)
      .getPublicUrl(fileData.object_path);

    // ── 9. Update asset_files with public_url and size ──
    await admin
      .from("asset_files")
      .update({
        public_url: publicUrlData?.publicUrl ?? null,
      })
      .eq("asset_id", body.asset_id);

    // ── 10. Update asset to ready ──
    await admin
      .from("assets")
      .update({
        status: "ready",
        size_bytes: fileInfo.metadata?.size ?? null,
      })
      .eq("id", body.asset_id);

    return new Response(
      JSON.stringify({
        success: true,
        asset_id: body.asset_id,
        status: "ready",
        public_url: publicUrlData?.publicUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("asset-confirm-upload error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
