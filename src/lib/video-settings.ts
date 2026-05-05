export type VideoProvider = "gumlet";

export interface VideoPlayerConfig {
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
}

export interface VideoSettings {
  provider: VideoProvider;
  player: VideoPlayerConfig;
}

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
  return (
    settings.player.player_color ??
    normalizeHexColor(fallbackColor) ??
    "#6366f1"
  );
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
      // Hard-enforced by product requirement.
      powered_by_gumlet_overlay: false,
    },
  };
}

export interface PlayerConfigOptions {
  fallbackColor?: string | null;
  /**
   * Whether captions are enabled for this tenant.
   * - `true`: Pro/Business — respect `captions_auto` from video_settings
   * - `false`: Free plan — force captions off
   * - `undefined`: fallback to `captions_auto` (used by DesignVideoPlayerPreview)
   */
  captionsEnabled?: boolean;
}

export function toGumletPlayerConfig(
  settings: unknown,
  options?: PlayerConfigOptions,
): Record<string, boolean | string> {
  const normalized = normalizeVideoSettings(settings);
  const { player } = normalized;
  const playerColor = resolvePlayerColor(normalized, options?.fallbackColor);

  // Resolve effective caption state:
  // explicit false → off | explicit true → use admin toggle | undefined → use admin toggle
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
  };
}

export function buildGumletEmbedUrl(
  gumletAssetId: string,
  settings?: unknown,
  options?: PlayerConfigOptions,
): string {
  const baseUrl = `https://play.gumlet.io/embed/${gumletAssetId}`;
  const playerConfig = toGumletPlayerConfig(settings, options);
  const params = new URLSearchParams();

  // Keep query params minimal; workspace settings are source of truth.
  if (playerConfig.preload) params.set("preload", "true");
  if (playerConfig.autoplay) params.set("autoplay", "true");
  if (playerConfig.loop) params.set("loop", "true");
  if (playerConfig.cast) params.set("cast", "true");
  if (playerConfig.caption_enabled) params.set("caption_enabled", "true");
  if (playerConfig.disable_seek) params.set("disable_seek", "true");
  if (playerConfig.disable_player_controls) params.set("disable_player_controls", "true");
  // show_video_title is always false: asset IDs are stored as titles (not human-readable names)
  params.set("show_video_title", "false");
  if (playerConfig.player_color) params.set("player_color", String(playerConfig.player_color));

  // Enable postMessage API for progress tracking (timeupdate, pause, ended events)
  params.set("api", "true");

  // Hard-enforced: never show provider branding.
  params.set("powered_by_gumlet_overlay", "false");

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}
