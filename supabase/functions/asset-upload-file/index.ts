import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type FileUploadRequest = {
  tenant_id: string;
  title: string;
  description?: string;
  filename: string;
  mime_type: string;
  size_bytes?: number;
  folder_id?: string | null;
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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    // 2. Parse request
    const body = (await req.json()) as FileUploadRequest;
    if (!body?.tenant_id || !body?.title || !body?.filename || !body?.mime_type) {
      return new Response(
        JSON.stringify({ error: "tenant_id, title, filename, and mime_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate user is editor of tenant
    const auth = await authorizeWorkspace(identity, body.tenant_id, supabaseAdmin, { minRole: "editor" });

    // 4. Create asset record with status='uploading'
    const { data: assetData, error: assetError } = await supabaseAdmin
      .from("assets")
      .insert({
        tenant_id: body.tenant_id,
        type: "file",
        title: body.title,
        description: body.description ?? null,
        folder_id: body.folder_id ?? null,
        mime_type: body.mime_type,
        size_bytes: body.size_bytes ?? null,
        status: "uploading",
        created_by: auth.userId,
      })
      .select("id")
      .single();

    if (assetError || !assetData) {
      console.error("Failed to create asset:", assetError);
      return new Response(JSON.stringify({ error: "Failed to create asset" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assetId = assetData.id;

    // 5. Build storage path: tenant/{tenant_id}/{asset_id}/{filename}
    // Sanitize filename
    const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `tenant/${body.tenant_id}/${assetId}/${safeFilename}`;
    const bucket = "assets";

    // 6. Create signed upload URL
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    if (uploadError || !uploadData) {
      console.error("Failed to create upload URL:", uploadError);
      await supabaseAdmin.from("assets").delete().eq("id", assetId);
      return new Response(JSON.stringify({ error: "Failed to create upload URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Create asset_files record
    const { error: fileError } = await supabaseAdmin.from("asset_files").insert({
      asset_id: assetId,
      bucket,
      object_path: objectPath,
      original_filename: body.filename,
    });

    if (fileError) {
      console.error("Failed to create asset_files:", fileError);
      await supabaseAdmin.from("assets").delete().eq("id", assetId);
      return new Response(JSON.stringify({ error: "Failed to create file record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        asset_id: assetId,
        upload_url: uploadData.signedUrl,
        upload_token: uploadData.token,
        object_path: objectPath,
        bucket,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("asset-upload-file error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
