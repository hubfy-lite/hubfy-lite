// Shared Gumlet utilities for edge functions

export const GUMLET_API_BASE = "https://api.gumlet.com/v1";

export interface GumletWorkspace {
  workspace_id: string;
  name: string;
}

export interface GumletWorkspaceResponse {
  workspace_id?: string;
  id?: string;
  name?: string;
}

export type VideoSettings = {
  provider: "gumlet";
  player: {
    preload: boolean;
    autoplay: boolean;
    loop: boolean;
    /** Request Gumlet to auto-generate subtitles on upload (AI). */
    captions_generate_auto: boolean;
    /** Show captions to the student by default in the player. */
    captions_auto: boolean;
    seek_enabled: boolean;
    controls_visible: boolean;
    player_color: string | null;
    powered_by_gumlet_overlay: boolean;
  };
};

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  provider: "gumlet",
  player: {
    preload: true,
    autoplay: false,
    loop: false,
    captions_generate_auto: false,
    captions_auto: false,
    seek_enabled: true,
    controls_visible: true,
    player_color: null,
    powered_by_gumlet_overlay: false,
  },
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function resolvePlayerColor(settings: VideoSettings, fallbackColor?: string | null): string {
  return settings.player.player_color
    ?? normalizeHexColor(fallbackColor)
    ?? "#6366f1";
}

export function normalizeVideoSettings(input: unknown): VideoSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rawPlayer =
    raw.player && typeof raw.player === "object"
      ? (raw.player as Record<string, unknown>)
      : {};

  return {
    provider: "gumlet",
    player: {
      preload: readBoolean(rawPlayer.preload, DEFAULT_VIDEO_SETTINGS.player.preload),
      autoplay: readBoolean(rawPlayer.autoplay, DEFAULT_VIDEO_SETTINGS.player.autoplay),
      loop: readBoolean(rawPlayer.loop, DEFAULT_VIDEO_SETTINGS.player.loop),
      captions_generate_auto: readBoolean(
        rawPlayer.captions_generate_auto,
        DEFAULT_VIDEO_SETTINGS.player.captions_generate_auto,
      ),
      captions_auto: readBoolean(rawPlayer.captions_auto, DEFAULT_VIDEO_SETTINGS.player.captions_auto),
      seek_enabled: readBoolean(rawPlayer.seek_enabled, DEFAULT_VIDEO_SETTINGS.player.seek_enabled),
      controls_visible: readBoolean(
        rawPlayer.controls_visible,
        DEFAULT_VIDEO_SETTINGS.player.controls_visible,
      ),
      player_color: normalizeHexColor(rawPlayer.player_color),
      powered_by_gumlet_overlay: false,
    },
  };
}

export function toGumletPlayerConfig(
  settings: unknown,
  options?: { fallbackColor?: string | null; captionsEnabled?: boolean },
): Record<string, string | boolean> {
  const normalized = normalizeVideoSettings(settings);
  const { player } = normalized;
  const playerColor = resolvePlayerColor(normalized, options?.fallbackColor);

  const effectiveCaptions =
    options?.captionsEnabled === false ? false : player.captions_auto;

  return {
    preload: player.preload,
    autoplay: player.autoplay,
    loop: player.loop,
    caption_enabled: effectiveCaptions,
    disable_seek: !player.seek_enabled,
    disable_player_controls: !player.controls_visible,
    player_color: playerColor,
    powered_by_gumlet_overlay: false,
    // show_title always false: asset IDs are stored as titles (not human-readable names)
    show_title: false,
  };
}

export async function updateGumletWorkspacePlayerConfig(
  apiKey: string,
  workspaceId: string,
  playerConfig: Record<string, string | boolean | Record<string, string>>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(
    `${GUMLET_API_BASE}/video/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player_config: playerConfig,
      }),
    },
  );

  const text = await response.text();
  let body: unknown = text;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function enforceNoGumletBranding(apiKey: string, workspaceId: string) {
  try {
    const result = await updateGumletWorkspacePlayerConfig(
      apiKey,
      workspaceId,
      { powered_by_gumlet_overlay: false },
    );

    if (!result.ok) {
      console.warn(
        `Failed to enforce no-branding for workspace ${workspaceId}:`,
        result.status,
        result.body,
      );
    }
  } catch (error) {
    console.warn("Failed to enforce no-branding in Gumlet workspace:", error);
  }
}

/**
 * Create a new workspace in Gumlet for a tenant
 * Gumlet uses "workspace" at the API level but returns "collection_id" for uploads
 * We store the workspace_id in our DB and use it as collection_id in upload calls
 */
export async function createGumletWorkspace(
  apiKey: string,
  workspaceName: string
): Promise<{ workspace_id: string } | null> {
  try {
    // Create workspace via POST /v1/video/workspaces
    const response = await fetch(`${GUMLET_API_BASE}/video/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: workspaceName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to create Gumlet workspace:", data);
      return null;
    }

    // Gumlet returns workspace_id or id
    const workspaceId = data?.workspace_id || data?.id;
    if (!workspaceId) {
      console.error("No workspace_id in Gumlet response:", data);
      return null;
    }

    console.log(`Created Gumlet workspace ${workspaceId} (name: ${workspaceName})`);
    return { workspace_id: workspaceId };
  } catch (error) {
    console.error("Error creating Gumlet workspace:", error);
    return null;
  }
}

/**
 * Get or create a workspace for a tenant
 * Returns the workspace_id, creating one if it doesn't exist
 *
 * Options:
 *   - existingWorkspaceId: skip the SELECT lookup if the caller already knows the id
 *   - skipBrandingEnforcement: skip the extra POST to Gumlet that sets
 *     powered_by_gumlet_overlay=false. Useful when the caller is going to send a
 *     full player_config update right after, which already includes that flag.
 */
export async function ensureGumletWorkspace(
  supabaseAdmin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  apiKey: string,
  tenantId: string,
  options?: { existingWorkspaceId?: string | null; skipBrandingEnforcement?: boolean },
): Promise<string | null> {
  let existing = options?.existingWorkspaceId ?? null;

  // 1. Look up workspace_id only if not provided
  if (!existing) {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenant_settings")
      .select("gumlet_workspace_id")
      .eq("tenant_id", tenantId)
      .single();

    if (tenantError) {
      console.error("Failed to fetch tenant:", tenantError);
      return null;
    }
    existing = tenant?.gumlet_workspace_id ?? null;
  }

  // 2. If workspace exists, return it
  if (existing) {
    console.log(`Tenant ${tenantId} already has workspace: ${existing}`);
    if (!options?.skipBrandingEnforcement) {
      await enforceNoGumletBranding(apiKey, existing);
    }
    return existing;
  }

  // 3. Fetch tenant public_id to use as workspace name in Gumlet
  const { data: tenantRow, error: tenantRowError } = await supabaseAdmin
    .from("tenants")
    .select("public_id")
    .eq("id", tenantId)
    .single();

  if (tenantRowError) {
    console.error("Failed to fetch tenant public_id:", tenantRowError);
    return null;
  }

  const workspaceName = tenantRow?.public_id || tenantId;

  // 4. Create new workspace in Gumlet
  const result = await createGumletWorkspace(apiKey, workspaceName);
  if (!result) {
    return null;
  }

  // 4. Save workspace_id to tenant_settings record
  const { error: updateError } = await supabaseAdmin
    .from("tenant_settings")
    .update({ gumlet_workspace_id: result.workspace_id })
    .eq("tenant_id", tenantId);

  if (updateError) {
    console.error("Failed to update tenant with workspace_id:", updateError);
    // Still return the workspace_id since it was created in Gumlet
  }

  await enforceNoGumletBranding(apiKey, result.workspace_id);

  return result.workspace_id;
}
