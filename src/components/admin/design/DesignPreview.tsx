import { useTranslation } from "react-i18next";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";

const PREVIEW_COVER = "/images/portal-backgrounds/creatopy-BrDJ-OauGxQ-unsplash.webp";

interface DesignPreviewProps {
  iconUrl: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  brandColor: string;
  themeMode: "light" | "dark";
  tenantName: string;
  previewMode?: "desktop" | "mobile";
}

/** Returns "#FFFFFF" or "#000000" based on relative luminance of a hex colour. */
function contrastColor(hex: string): "#FFFFFF" | "#000000" {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.179 ? "#000000" : "#FFFFFF";
}

export default function DesignPreview({
  iconUrl,
  iconName,
  iconColor,
  brandColor,
  themeMode,
  tenantName,
  previewMode = "desktop",
}: DesignPreviewProps) {
  const { t } = useTranslation();
  const brandFg = contrastColor(brandColor);
  const isDark = themeMode === "dark";

  const bg = isDark ? "#0A0A0A" : "#F9F9F9";
  const cardBg = isDark ? "#161616" : "#FFFFFF";
  const textPrimary = isDark ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDark ? "#A0A0A0" : "#666";
  const textTertiary = isDark ? "#555" : "#AAA";
  const border = isDark ? "#262626" : "#EBEBEB";

  const isMobile = previewMode === "mobile";

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── Topbar ── */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-2">
          <WorkspaceAvatar
            iconUrl={iconUrl}
            iconName={iconName}
            iconColor={iconColor}
            size="sm"
            className="rounded-full shrink-0"
          />
          <span className="text-[11px] font-semibold" style={{ color: textPrimary }}>
            {tenantName || t("designPage.preview.yourCompany")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {["nav.home", "nav.courses", "nav.myProfile"].map((key) => (
            <span key={key} className="text-[9px]" style={{ color: textSecondary }}>
              {t(key)}
            </span>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden px-4 pt-5 pb-4">
        {/* Hero banner */}
        <div
          className="w-full rounded-lg overflow-hidden mb-4 relative"
          style={{ height: isMobile ? 80 : 100, background: brandColor }}
        >
          <img
            src={PREVIEW_COVER}
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 flex flex-col justify-center px-4">
            <p className="text-[10px] font-semibold" style={{ color: brandFg }}>
              {t("designPage.preview.yourCompany")}
            </p>
            <p className="text-[8px] opacity-80" style={{ color: brandFg }}>
              {t("designPage.preview.productDescription")}
            </p>
          </div>
        </div>

        {/* Product cards */}
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden"
              style={{ background: cardBg, border: `1px solid ${border}` }}
            >
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={PREVIEW_COVER}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2.5">
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: textPrimary }}>
                  {t("designPage.preview.productName")}
                </p>
                <p className="text-[8px]" style={{ color: textSecondary }}>
                  {t("designPage.preview.productPrice")}
                </p>
                <div
                  className="mt-2 w-full h-6 rounded-md flex items-center justify-center text-[9px] font-semibold"
                  style={{ background: brandColor, color: brandFg }}
                >
                  {t("portal.nav.products")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="shrink-0 flex items-center justify-center py-2"
        style={{ borderTop: `1px solid ${border}` }}
      >
        <span className="text-[8px]" style={{ color: textTertiary }}>
          {tenantName || t("designPage.preview.yourCompany")} · Hubfy
        </span>
      </div>
    </div>
  );
}
