import { cn } from "@/lib/utils";
import { WORKSPACE_ICON_MAP } from "@/lib/workspace-icons";
import { BRAND_DEFAULT_TENANT_ICON } from "@/lib/brand";

const DEFAULT_TENANT_ICON = BRAND_DEFAULT_TENANT_ICON;

const sizes = {
  sm: { box: "size-6", icon: "size-3.5", fallback: "size-3.5" },
  md: { box: "size-8", icon: "size-4", fallback: "size-5" },
  lg: { box: "size-14", icon: "size-7", fallback: "size-7" },
} as const;

function shouldUseDarkIconOnColor(hexColor: string): boolean {
  const color = hexColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(color)) return false;

  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);

  // Relative luminance approximation for readable icon color.
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6;
}

interface WorkspaceAvatarProps {
  iconUrl?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export function WorkspaceAvatar({
  iconUrl,
  iconName,
  iconColor,
  size = "md",
  className,
}: WorkspaceAvatarProps) {
  const s = sizes[size];

  // Priority 1: uploaded icon image
  if (iconUrl) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg overflow-hidden",
          s.box,
          className,
        )}
      >
        <img src={iconUrl} alt="" className="size-full object-cover" />
      </div>
    );
  }

  // Priority 2: Lucide icon + color
  if (iconName && iconColor) {
    const LucideIcon = WORKSPACE_ICON_MAP[iconName];
    const iconTone = shouldUseDarkIconOnColor(iconColor)
      ? "text-gray-900"
      : "text-white";

    if (LucideIcon) {
      return (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            s.box,
            className,
          )}
          style={{ backgroundColor: iconColor }}
        >
          <LucideIcon className={cn(s.icon, iconTone)} strokeWidth={2} />
        </div>
      );
    }
  }

  // Fallback: default Hubfy icon
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground",
        s.box,
        className,
      )}
    >
      <img src={DEFAULT_TENANT_ICON} alt="Hubfy" className={s.fallback} />
    </div>
  );
}
