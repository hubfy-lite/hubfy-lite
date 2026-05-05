import { Sun, Globe, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";
import { cn } from "@/lib/utils";

const RADIUS_CLASS: Record<string, string> = {
  rounded: "rounded-[4px]",
  rectangular: "rounded-none",
  pill: "rounded-[12px]",
};

const PREVIEW_ITEMS = [
  {
    id: "1",
    title: "Curso de Marketing Digital",
    imageSrc:
      "/images/portal-backgrounds/anastase-maragos-jzP8_Rg6aVU-unsplash.webp",
  },
  {
    id: "2",
    title: "Pack 1.000 Templates Premium",
    imageSrc:
      "/images/portal-backgrounds/creatopy-BrDJ-OauGxQ-unsplash.webp",
  },
  {
    id: "3",
    title: "Criando um SaaS com IA",
    imageSrc:
      "/images/portal-backgrounds/michael-soledad-9juYjd6iQLU-unsplash.webp",
  },
  {
    id: "4",
    title: "Seu Primeiro Cliente em 7 Dias",
    imageSrc:
      "/images/portal-backgrounds/samuel-myles-4hppPVIwWyE-unsplash.webp",
    muted: true,
  },
];

interface DesignPortalPreviewProps {
  themeMode: "light" | "dark";
  radiusStyle: string;
  previewMode?: "desktop" | "mobile";
  iconUrl?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  tenantName?: string;
}

export default function DesignPortalPreview({
  themeMode,
  radiusStyle,
  previewMode = "desktop",
  iconUrl,
  iconName,
  iconColor,
  tenantName,
}: DesignPortalPreviewProps) {
  const { t } = useTranslation();
  const isDark = themeMode === "dark";
  const isMobile = previewMode === "mobile";

  const backgroundColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";
  const headerBg = isDark ? "rgba(10,10,10,0.90)" : "rgba(255,255,255,0.92)";
  const textPrimary = isDark ? "#F5F5F5" : "#111827";
  const textMuted = isDark ? "#71717A" : "#9CA3AF";
  const iconBtnBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const iconBtnColor = isDark ? "#A1A1AA" : "#6B7280";
  const navBtnBorder = isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB";
  const navBtnBg = isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB";


  const displayName = tenantName || "Minha Escola";
  const radiusClass = RADIUS_CLASS[radiusStyle] || RADIUS_CLASS.rounded;

  return (
    <div
      className="h-full flex flex-col overflow-auto"
      style={{
        background: backgroundColor,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-3 py-2 shrink-0"
        style={{ borderColor, background: headerBg }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <WorkspaceAvatar
            iconUrl={iconUrl}
            iconName={iconName}
            iconColor={iconColor}
            size="sm"
            className="rounded-full shrink-0"
          />
          <span
            className="text-[11px] font-semibold truncate"
            style={{ color: textPrimary }}
          >
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {[Sun, Globe, User].map((Icon, i) => (
            <div
              key={i}
              className="flex size-6 items-center justify-center rounded-full"
              style={{ background: iconBtnBg }}
            >
              <Icon className="size-2.5" style={{ color: iconBtnColor }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Content (simula margens de uma tela ~1600px) ── */}
      <div className={cn("flex-1 pt-6 pb-4", isMobile ? "px-10" : "px-16")}>
        {/* Saudação */}
        <div className={cn("mb-2.5", isMobile ? "w-full" : "w-1/2")}>
          <h1
            className="text-[15px] font-semibold leading-tight mb-1"
            style={{ color: textPrimary }}
          >
            Olá, Frederico!
          </h1>
          <p className="text-[9px] leading-relaxed" style={{ color: textMuted }}>
            {t("designPage.portal.previewGreetingSubtitle")}
          </p>
        </div>

        {/* Navegação + grid */}
        <div>
          {/* Setas de navegação */}
          <div className="flex items-center justify-end gap-1 mb-2.5">
            {[ChevronLeft, ChevronRight].map((Icon, i) => (
              <div
                key={i}
                className="flex size-5 items-center justify-center rounded-full border"
                style={{ border: `1px solid ${navBtnBorder}`, background: navBtnBg }}
              >
                <Icon className="size-2.5" style={{ color: iconBtnColor }} />
              </div>
            ))}
          </div>

          {/* Grid 4 colunas fixo */}
          <div className={cn("grid gap-2.5", isMobile ? "grid-cols-1" : "grid-cols-4")}>
            {PREVIEW_ITEMS.map((item) => (
              <div
                key={item.id}
                className={cn("block w-full", item.muted && "opacity-45")}
              >
                {/* Imagem portrait */}
                <div
                  className={cn(
                    "relative aspect-[4/5] overflow-hidden",
                    isDark ? "bg-white/5" : "bg-gray-100",
                    radiusClass
                  )}
                >
                  <img
                    src={item.imageSrc}
                    alt={item.title}
                    className="size-full object-cover"
                  />
                </div>
                {/* Título */}
                <p
                  className="mt-1 text-[12px] font-medium leading-snug line-clamp-2"
                  style={{ color: textPrimary }}
                >
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
