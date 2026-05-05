import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-gumlet-token",
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
    // 1. Validate webhook secret (mandatory)
    const webhookSecret = Deno.env.get("GUMLET_SIGNING_SECRET");
    if (!webhookSecret) {
      console.error("GUMLET_SIGNING_SECRET not configured — rejecting request");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headerToken =
      req.headers.get("x-gumlet-token") || req.headers.get("X-Gumlet-Token");
    if (headerToken !== webhookSecret) {
      console.error("Invalid webhook token received");
      return new Response(JSON.stringify({ error: "Invalid webhook token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse payload
    const payload = await req.json();
    console.log("Gumlet webhook received:", JSON.stringify(payload, null, 2));

    // Extract asset_id from various payload formats
    const gumletAssetId =
      payload?.asset_id ||
      payload?.data?.asset_id ||
      payload?.video?.asset_id ||
      payload?.data?.video?.asset_id ||
      payload?.id;

    if (!gumletAssetId) {
      return new Response(JSON.stringify({ error: "asset_id missing in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract workspace/collection_id from payload
    // Gumlet includes it in source_url as first path segment: "{collection_id}/{asset_id}/origin-{asset_id}"
    // Also try direct fields as fallback
    let gumletWorkspaceId: string | null = null;
    
    // Try source_url first (most reliable)
    const sourceUrl = payload?.input?.source_url || payload?.source_url || null;
    if (sourceUrl && typeof sourceUrl === "string") {
      const segments = sourceUrl.split("/");
      if (segments.length > 0 && segments[0]) {
        gumletWorkspaceId = segments[0];
      }
    }
    
    // Fallback to direct fields
    if (!gumletWorkspaceId) {
      gumletWorkspaceId =
        payload?.collection_id ||
        payload?.vod_collection_id ||
        payload?.data?.collection_id ||
        payload?.data?.vod_collection_id ||
        null;
    }

    console.log(`Processing webhook for asset ${gumletAssetId}, workspace/collection ${gumletWorkspaceId || 'unknown'}`);

    // 3. Extract status and metadata
    const eventType =
      payload?.event || payload?.event_type || payload?.type || null;
    
    const gumletStatus = payload?.status || null;
    
    const duration =
      payload?.input?.duration ||
      payload?.data?.duration ||
      payload?.video?.duration ||
      payload?.data?.video?.duration ||
      null;
    
    // Gumlet returns playback_url in output object
    const playbackUrl =
      payload?.output?.playback_url ||
      payload?.data?.playback_url ||
      payload?.video?.playback_url ||
      payload?.playback_url ||
      null;
    
    // Extract thumbnail URL - can be string or array (Gumlet returns array)
    let thumbnailUrl: string | null = null;
    const rawThumbnail =
      payload?.output?.thumbnail_url ||
      payload?.data?.thumbnail_url ||
      payload?.video?.thumbnail_url ||
      payload?.thumbnail_url ||
      null;
    
    if (Array.isArray(rawThumbnail) && rawThumbnail.length > 0) {
      thumbnailUrl = rawThumbnail[0];
    } else if (typeof rawThumbnail === "string") {
      thumbnailUrl = rawThumbnail;
    }
    
    console.log(`Webhook event: ${eventType}, gumlet_status: ${gumletStatus}, playback_url: ${playbackUrl ? 'present' : 'null'}, thumbnail_url: ${thumbnailUrl ? 'present' : 'null'}`);

    // Map Gumlet webhook events to our asset status.
    // Event types (from https://docs.gumlet.com/docs/webhooks):
    //   event.video.uploaded          — bytes reached Gumlet (leaves "uploading")
    //   video.status.created          — asset row created (we already know — ignored)
    //   video.status.downloaded       — Gumlet fetched the source file
    //   video.status.stream_ready     — HLS is playable in at least one resolution
    //   video.status.processed        — all resolutions transcoded
    //   video.status.ready            — fully ready to embed
    //   video.status.errored          — processing failed
    //   video.status.deleted          — asset deleted on Gumlet side
    //   event.video.updated           — metadata change (ignored)
    //   video.status.repackaged       — caption/audio added (ignored)
    let newStatus: string | null = null;

    if (
      eventType === "video.status.ready" ||
      eventType === "video.status.stream_ready" ||
      eventType === "video.status.processed" ||
      eventType === "video.asset.ready"
    ) {
      newStatus = "ready";
    } else if (
      eventType === "video.status.errored" ||
      eventType === "video.asset.errored"
    ) {
      newStatus = "failed";
    } else if (eventType === "video.status.deleted") {
      newStatus = "deleted";
    } else if (
      eventType === "event.video.uploaded" ||
      eventType === "video.status.downloaded"
    ) {
      // Bytes reached Gumlet — leave "uploading" and enter processing
      newStatus = "processing";
    } else if (
      eventType === "video.status.created" ||
      eventType === "event.video.updated" ||
      eventType === "video.status.repackaged"
    ) {
      // Informational events — ack without changing status
      newStatus = null;
    } else if (gumletStatus === "ready") {
      newStatus = "ready";
    } else if (gumletStatus === "errored" || gumletStatus === "error" || gumletStatus === "failed") {
      newStatus = "failed";
    } else if (["pre-processing", "queued", "processing", "validated"].includes(gumletStatus || "")) {
      newStatus = "processing";
    }
    // If newStatus is still null, we don't touch the status column (only metadata).

    console.log(`Mapped status: ${newStatus ?? '(no change)'} (from gumletStatus: ${gumletStatus}, eventType: ${eventType})`);

    // 4. Update database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Find asset_videos by gumlet_asset_id
    const { data: videoData, error: videoFetchError } = await supabaseAdmin
      .from("asset_videos")
      .select("asset_id")
      .eq("gumlet_asset_id", gumletAssetId)
      .maybeSingle();

    if (videoFetchError || !videoData) {
      console.error("Asset video not found for gumlet_asset_id:", gumletAssetId);
      // Log additional info for debugging
      if (gumletWorkspaceId) {
        console.log(`Webhook from workspace ${gumletWorkspaceId} - asset may not exist yet`);
      }
      return new Response(JSON.stringify({ error: "Asset video not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assetId = videoData.asset_id;

    // Verify workspace matches tenant (optional security check)
    if (gumletWorkspaceId) {
      const { data: assetData } = await supabaseAdmin
        .from("assets")
        .select("tenant_id")
        .eq("id", assetId)
        .single();

      if (assetData) {
        const { data: settingsData } = await supabaseAdmin
          .from("tenant_settings")
          .select("gumlet_workspace_id")
          .eq("tenant_id", assetData.tenant_id)
          .maybeSingle();

        const tenantWorkspaceId = settingsData?.gumlet_workspace_id;
        if (tenantWorkspaceId && tenantWorkspaceId !== gumletWorkspaceId) {
          console.warn(`Workspace mismatch: expected ${tenantWorkspaceId}, got ${gumletWorkspaceId}`);
          // Don't block the update, just log the warning
        }
      }
    }

    // Extract structured video metadata from input
    const inputWidth = payload?.input?.width ?? null;
    const inputHeight = payload?.input?.height ?? null;
    const inputAspectRatio = payload?.input?.aspect_ratio ?? null;
    const inputFps = payload?.input?.fps ?? null;
    const inputOriginalSize = payload?.input?.size ?? null;
    const progressPct = payload?.progress ?? null;

    // Update asset_videos
    const videoUpdate: Record<string, unknown> = {
      processing_meta: payload,
    };
    if (duration !== null) videoUpdate.duration_seconds = Math.round(duration);
    if (playbackUrl) videoUpdate.playback_url = playbackUrl;
    if (thumbnailUrl) videoUpdate.thumbnail_url = thumbnailUrl;
    if (inputWidth !== null) videoUpdate.width = inputWidth;
    if (inputHeight !== null) videoUpdate.height = inputHeight;
    if (inputAspectRatio) videoUpdate.aspect_ratio = inputAspectRatio;
    if (inputFps !== null) videoUpdate.fps = inputFps;
    if (inputOriginalSize !== null) videoUpdate.original_size_bytes = inputOriginalSize;
    if (progressPct !== null) videoUpdate.progress_pct = progressPct;

    // When video.status.ready fires, everything is done — including subtitles.
    // Promote subtitles_status from 'generating' to 'ready'. Leave NULL rows
    // untouched (legacy videos without auto-subtitles).
    const isFullyReady =
      eventType === "video.status.ready" ||
      eventType === "video.asset.ready" ||
      eventType === "video.status.repackaged";

    if (isFullyReady) {
      await supabaseAdmin
        .from("asset_videos")
        .update({ subtitles_status: "ready" })
        .eq("asset_id", assetId)
        .eq("subtitles_status", "generating");
    }

    const { error: videoUpdateError } = await supabaseAdmin
      .from("asset_videos")
      .update(videoUpdate)
      .eq("asset_id", assetId);

    if (videoUpdateError) {
      console.error("Failed to update asset_videos:", videoUpdateError);
    }

    // Update assets status + size (skip status update for informational events)
    const assetUpdate: Record<string, unknown> = {
      ...(newStatus !== null ? { status: newStatus } : {}),
      ...(inputOriginalSize !== null ? { size_bytes: inputOriginalSize } : {}),
    };

    if (Object.keys(assetUpdate).length > 0) {
      const { error: assetUpdateError } = await supabaseAdmin
        .from("assets")
        .update(assetUpdate)
        .eq("id", assetId);

      if (assetUpdateError) {
        console.error("Failed to update assets:", assetUpdateError);
        return new Response(JSON.stringify({ error: "Failed to update asset" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Asset ${assetId} updated to status: ${newStatus ?? '(no change)'}${gumletWorkspaceId ? ` (workspace: ${gumletWorkspaceId})` : ''}`);

    return new Response(
      JSON.stringify({ 
        received: true, 
        asset_id: assetId, 
        status: newStatus,
        workspace_id: gumletWorkspaceId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("asset-webhook-gumlet error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
