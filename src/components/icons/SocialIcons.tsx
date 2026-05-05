import type { LucideProps } from "lucide-react";
import {
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  Twitch,
  Github,
} from "lucide-react";

/* ─── TikTok (Lucide doesn't ship one) ─── */
export function TikTokIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

/* ─── Platform registry ─── */
export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", Icon: Instagram, baseUrl: "instagram.com/", default: true },
  { key: "youtube",   label: "YouTube",   Icon: Youtube,   baseUrl: "youtube.com/@",  default: true },
  { key: "x",         label: "X",         Icon: Twitter,   baseUrl: "x.com/",          default: true },
  { key: "tiktok",    label: "TikTok",    Icon: TikTokIcon, baseUrl: "tiktok.com/@",  default: true },
  { key: "facebook",  label: "Facebook",  Icon: Facebook,  baseUrl: "facebook.com/",  default: false },
  { key: "twitch",    label: "Twitch",    Icon: Twitch,    baseUrl: "twitch.tv/",     default: false },
  { key: "github",    label: "GitHub",    Icon: Github,    baseUrl: "github.com/",    default: false },
] as const;

export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number]["key"];

/** The 4 platforms shown by default in settings */
export const DEFAULT_SOCIAL_KEYS = SOCIAL_PLATFORMS.filter((p) => p.default).map((p) => p.key);

/** Lookup a platform by key */
export const getSocialPlatform = (key: string) => SOCIAL_PLATFORMS.find((p) => p.key === key);
