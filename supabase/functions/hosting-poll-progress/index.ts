import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GUMLET_API_BASE = "https://api.gumlet.com/v1";

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
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gumletApiKey = Deno.env.get("GUMLET_API_KEY");

    if (!gumletApiKey) {
      return new Response(JSON.stringify({ error: "Gumlet API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to query processing videos
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Poll both "uploading" and "processing" so the polling fallback can
    // rescue assets stuck in uploading when the hosting webhook is delayed
    // or dropped (e.g. event.video.uploaded never arrives).
    const { data: pendingAssets, error: fetchError } = await supabaseAdmin
      .from("assets")
      .select("id, status, asset_videos!inner(gumlet_asset_id)")
      .eq("tenant_id", tenant_id)
      .in("status", ["uploading", "processing"]);

    if (fetchError) {
      console.error("Failed to fetch pending assets:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch assets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingAssets || pendingAssets.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Polling ${pendingAssets.length} pending video(s) for tenant ${tenant_id}`);

    let updated = 0;

    for (const asset of pendingAssets) {
      const videoRecord = Array.isArray(asset.asset_videos)
        ? asset.asset_videos[0]
        : asset.asset_videos;
      if (!videoRecord?.gumlet_asset_id) continue;

      try {
        // GET hosting asset status
        const gumletRes = await fetch(
          `${GUMLET_API_BASE}/video/assets/${videoRecord.gumlet_asset_id}`,
          {
            headers: { Authorization: `Bearer ${gumletApiKey}` },
          }
        );

        if (!gumletRes.ok) {
          console.error(`Hosting API error for ${videoRecord.gumlet_asset_id}: ${gumletRes.status}`);
          continue;
        }

        const gumlet = await gumletRes.json();
        console.log(`Asset ${videoRecord.gumlet_asset_id}: localStatus=${asset.status}, remoteStatus=${gumlet.status}, progress=${gumlet.progress}`);

        // Map remote status to our local status.
        // Remote states: upload-pending, pre-processing, queued, processing, ready, errored
        // Promotion rules:
        //   - upload-pending: bytes haven't reached hosting yet → keep "uploading"
        //   - pre-processing/queued/processing/validated: hosting has bytes → "processing"
        //   - ready: "ready"
        //   - errored/error/failed: "failed"
        let newStatus: string;
        if (gumlet.status === "ready") {
          newStatus = "ready";
        } else if (gumlet.status === "errored" || gumlet.status === "error" || gumlet.status === "failed") {
          newStatus = "failed";
        } else if (gumlet.status === "upload-pending") {
          // Bytes still not uploaded — leave the asset in "uploading"
          newStatus = "uploading";
        } else {
          // pre-processing, queued, processing, validated, or anything else hosting has
          newStatus = "processing";
        }

        // Only extract thumbnail + playback when ready (avoids flickering fallback icons)
        let thumbnailUrl: string | null = null;
        let playbackUrl: string | null = null;
        if (newStatus === "ready") {
          const rawThumb = gumlet?.output?.thumbnail_url ?? gumlet?.thumbnail_url ?? null;
          if (Array.isArray(rawThumb) && rawThumb.length > 0) {
            thumbnailUrl = rawThumb[0];
          } else if (typeof rawThumb === "string") {
            thumbnailUrl = rawThumb;
          }
          playbackUrl = gumlet?.output?.playback_url ?? gumlet?.playback_url ?? null;
        }

        // Extract metadata
        const width = gumlet?.input?.width ?? null;
        const height = gumlet?.input?.height ?? null;
        const aspectRatio = gumlet?.input?.aspect_ratio ?? null;
        const fps = gumlet?.input?.fps ?? null;
        const originalSize = gumlet?.input?.size ?? null;
        const duration = gumlet?.input?.duration ?? null;
        const rawProgress = gumlet?.progress ?? null;

        // Fetch current progress to prevent going backwards (99% -> 0% flicker)
        const { data: currentVideo } = await supabaseAdmin
          .from("asset_videos")
          .select("progress_pct")
          .eq("asset_id", asset.id)
          .single();
        const currentPct = currentVideo?.progress_pct ?? 0;

        // Update asset_videos
        const videoUpdate: Record<string, unknown> = {};
        if (rawProgress !== null && rawProgress !== undefined && rawProgress >= currentPct) {
          videoUpdate.progress_pct = rawProgress;
        }
        if (thumbnailUrl) videoUpdate.thumbnail_url = thumbnailUrl;
        if (playbackUrl) videoUpdate.playback_url = playbackUrl;
        if (width !== null) videoUpdate.width = width;
        if (height !== null) videoUpdate.height = height;
        if (aspectRatio) videoUpdate.aspect_ratio = aspectRatio;
        if (fps !== null) videoUpdate.fps = fps;
        if (originalSize !== null) videoUpdate.original_size_bytes = originalSize;
        if (duration !== null) videoUpdate.duration_seconds = Math.round(duration);

        if (Object.keys(videoUpdate).length > 0) {
          await supabaseAdmin
            .from("asset_videos")
            .update(videoUpdate)
            .eq("asset_id", asset.id);
        }

        // Update asset status + size
        const assetUpdate: Record<string, unknown> = { status: newStatus };
        if (originalSize !== null) assetUpdate.size_bytes = originalSize;

        await supabaseAdmin
          .from("assets")
          .update(assetUpdate)
          .eq("id", asset.id);

        updated++;
      } catch (err) {
        console.error(`Error polling asset ${asset.id}:`, err);
      }
    }

    console.log(`Updated ${updated}/${pendingAssets.length} assets`);

    return new Response(JSON.stringify({ updated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("gumlet-poll-progress error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
