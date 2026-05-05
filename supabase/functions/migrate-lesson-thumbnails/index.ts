import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-migrate-token",
};

const BATCH_SIZE_DEFAULT = 200;
const MAX_ERRORS = 100;

type MigrateBody = {
  dry_run?: boolean;
  batch_size?: number;
  max_rows?: number;
};

type ParsedThumbnail = {
  cleanedOriginal: string;
  path: string | null;
  sourceBucket: "assets" | "covers" | null;
  isExternal: boolean;
};

type CopyResult = {
  copied: boolean;
  skippedExisting: boolean;
  error?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const migrationToken = Deno.env.get("MIGRATE_LESSON_THUMBNAILS_TOKEN");
    if (!migrationToken) {
      return jsonResponse(
        { error: "MIGRATE_LESSON_THUMBNAILS_TOKEN not configured" },
        500,
      );
    }

    const headerToken = req.headers.get("x-migrate-token");
    if (headerToken !== migrationToken) {
      return jsonResponse({ error: "Invalid migration token" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase env not configured" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as MigrateBody;
    const dryRun = body.dry_run === true;
    const batchSize = Math.max(1, Math.min(body.batch_size ?? BATCH_SIZE_DEFAULT, 1000));
    const maxRows = Math.max(0, body.max_rows ?? 0);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const stats = {
      scanned: 0,
      eligible: 0,
      skippedExternal: 0,
      copiedToCovers: 0,
      alreadyInCovers: 0,
      updatedRows: 0,
      copyFailures: 0,
      updateFailures: 0,
    };

    const errors: Array<{ lesson_id: string; reason: string }> = [];

    let offset = 0;
    let exhausted = false;

    while (!exhausted) {
      const to = offset + batchSize - 1;
      const { data: rows, error: fetchError } = await supabaseAdmin
        .from("lessons")
        .select("id, thumbnail_url")
        .not("thumbnail_url", "is", null)
        .order("created_at", { ascending: true })
        .range(offset, to);

      if (fetchError) {
        return jsonResponse({ error: "Failed to fetch lessons", details: fetchError.message }, 500);
      }

      if (!rows || rows.length === 0) {
        exhausted = true;
        break;
      }

      for (const row of rows) {
        if (maxRows > 0 && stats.scanned >= maxRows) {
          exhausted = true;
          break;
        }

        stats.scanned += 1;
        const lessonId = row.id;
        const thumbnailValue = row.thumbnail_url;
        if (!thumbnailValue) continue;

        const parsed = parseThumbnailValue(thumbnailValue);

        if (!parsed.path) {
          if (parsed.isExternal) {
            stats.skippedExternal += 1;
          }
          continue;
        }

        stats.eligible += 1;

        let canUpdate = true;

        if (!dryRun) {
          if (parsed.sourceBucket === "assets") {
            const copy = await copyAssetToCovers(supabaseAdmin, parsed.path);
            if (copy.error) {
              canUpdate = false;
              stats.copyFailures += 1;
              pushError(errors, {
                lesson_id: lessonId,
                reason: `copy assets->covers failed (${parsed.path}): ${copy.error}`,
              });
            } else if (copy.copied) {
              stats.copiedToCovers += 1;
            } else if (copy.skippedExisting) {
              stats.alreadyInCovers += 1;
            }
          } else if (parsed.sourceBucket === null) {
            // Path-only legacy rows: ensure file exists in covers, best-effort copy from assets.
            const existsInCovers = await objectExistsInBucket(supabaseAdmin, "covers", parsed.path);
            if (existsInCovers) {
              stats.alreadyInCovers += 1;
            } else {
              const copy = await copyAssetToCovers(supabaseAdmin, parsed.path);
              if (copy.error) {
                // Keep row as-is; this path might intentionally point elsewhere.
                pushError(errors, {
                  lesson_id: lessonId,
                  reason: `path not found in covers/assets (${parsed.path}): ${copy.error}`,
                });
              } else if (copy.copied) {
                stats.copiedToCovers += 1;
              } else if (copy.skippedExisting) {
                stats.alreadyInCovers += 1;
              }
            }
          }
        }

        const shouldNormalize = parsed.cleanedOriginal !== parsed.path;

        if (!dryRun && canUpdate && shouldNormalize) {
          const { error: updateError } = await supabaseAdmin
            .from("lessons")
            .update({ thumbnail_url: parsed.path })
            .eq("id", lessonId);

          if (updateError) {
            stats.updateFailures += 1;
            pushError(errors, {
              lesson_id: lessonId,
              reason: `update failed: ${updateError.message}`,
            });
          } else {
            stats.updatedRows += 1;
          }
        }
      }

      offset += rows.length;
      if (rows.length < batchSize) {
        exhausted = true;
      }
    }

    return jsonResponse({ dry_run: dryRun, stats, errors }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: "Internal server error", details: message }, 500);
  }
});

function parseThumbnailValue(input: string): ParsedThumbnail {
  const cleaned = stripQueryAndHash(input.trim());
  if (!cleaned) {
    return {
      cleanedOriginal: "",
      path: null,
      sourceBucket: null,
      isExternal: false,
    };
  }

  if (!cleaned.startsWith("http")) {
    return {
      cleanedOriginal: cleaned,
      path: cleaned.replace(/^\/+/, ""),
      sourceBucket: null,
      isExternal: false,
    };
  }

  const marker = "/storage/v1/object/public/";
  const markerIndex = cleaned.indexOf(marker);
  if (markerIndex === -1) {
    return {
      cleanedOriginal: cleaned,
      path: null,
      sourceBucket: null,
      isExternal: true,
    };
  }

  const objectRef = cleaned.slice(markerIndex + marker.length);
  const slashIndex = objectRef.indexOf("/");
  if (slashIndex === -1) {
    return {
      cleanedOriginal: cleaned,
      path: null,
      sourceBucket: null,
      isExternal: true,
    };
  }

  const bucket = objectRef.slice(0, slashIndex);
  const path = safeDecodeURIComponent(objectRef.slice(slashIndex + 1)).replace(/^\/+/, "");

  if (bucket === "assets" || bucket === "covers") {
    return {
      cleanedOriginal: cleaned,
      path,
      sourceBucket: bucket,
      isExternal: false,
    };
  }

  return {
    cleanedOriginal: cleaned,
    path: null,
    sourceBucket: null,
    isExternal: true,
  };
}

async function objectExistsInBucket(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: "assets" | "covers",
  path: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  return !error && !!data;
}

async function copyAssetToCovers(
  supabaseAdmin: ReturnType<typeof createClient>,
  path: string,
): Promise<CopyResult> {
  const existsInCovers = await objectExistsInBucket(supabaseAdmin, "covers", path);
  if (existsInCovers) {
    return { copied: false, skippedExisting: true };
  }

  const { data: sourceBlob, error: sourceError } = await supabaseAdmin.storage
    .from("assets")
    .download(path);

  if (sourceError || !sourceBlob) {
    return {
      copied: false,
      skippedExisting: false,
      error: sourceError?.message ?? "Source object not found",
    };
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from("covers")
    .upload(path, sourceBlob, {
      upsert: true,
      contentType: sourceBlob.type || undefined,
    });

  if (uploadError) {
    return {
      copied: false,
      skippedExisting: false,
      error: uploadError.message,
    };
  }

  return { copied: true, skippedExisting: false };
}

function stripQueryAndHash(value: string): string {
  const noHash = value.split("#", 1)[0];
  return noHash.split("?", 1)[0];
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pushError(errors: Array<{ lesson_id: string; reason: string }>, entry: { lesson_id: string; reason: string }) {
  if (errors.length >= MAX_ERRORS) return;
  errors.push(entry);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
