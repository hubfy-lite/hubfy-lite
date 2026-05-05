import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { contrastColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";

const BUTTON_RADIUS: Record<string, string> = {
  rounded: "8px",
  rectangular: "2px",
  pill: "9999px",
};

interface DesignLoginPagePreviewProps {
  iconUrl: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  brandColor: string;
  tenantName: string;
  previewMode?: "desktop" | "mobile";
  portalThemeMode: "light" | "dark";
  portalBgImageUrl: string | null;
  portalButtonColor: string;
  portalButtonStyle: string;
}

export default function DesignLoginPagePreview({
  iconUrl,
  iconName,
  iconColor,
  brandColor,
  tenantName,
  previewMode = "desktop",
  portalThemeMode,
  portalBgImageUrl,
  portalButtonColor,
  portalButtonStyle = "rounded",
}: DesignLoginPagePreviewProps) {
  const { t } = useTranslation();
  const isMobile = previewMode === "mobile";
  const isDark = portalThemeMode === "dark";

  const bgColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const cardBg = isDark ? "#141414" : "#FFFFFF";
  const textPrimary = isDark ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDark ? "#A0A0A0" : "#666666";
  const inputBg = isDark ? "#1A1A1A" : "#F5F5F5";
  const inputBorder = isDark ? "#2A2A2A" : "#E5E5E5";
  const dividerColor = isDark ? "#1F1F1F" : "#F0F0F0";

  const buttonColor = portalButtonColor || brandColor;
  const buttonFg = contrastColor(buttonColor);
  const buttonRadius = BUTTON_RADIUS[portalButtonStyle] || BUTTON_RADIUS.rounded;

  return (
    <div
      className={isMobile ? "flex flex-col h-full" : "flex flex-row h-full"}
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      {/* ═══ LEFT PANEL — Background image ═══ */}
      {!isMobile && (
        <div
          className="w-1/2 relative"
          style={{ background: bgColor }}
        >
          {portalBgImageUrl ? (
            <img
              src={portalBgImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            />
          )}
        </div>
      )}

      {/* ═══ RIGHT PANEL — Login form ═══ */}
      <div
        className={cn(
          "flex items-center justify-center",
          isMobile ? "flex-1" : "w-1/2",
        )}
        style={{ background: bgColor }}
      >
        <div
          className="w-full px-4"
          style={{ maxWidth: isMobile ? "100%" : "280px" }}
        >
          {/* Tenant branding */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <WorkspaceAvatar
              iconUrl={iconUrl}
              iconName={iconName}
              iconColor={iconColor}
              size="sm"
              className="rounded-full shrink-0"
            />
            <span
              className="text-[12px] font-semibold"
              style={{ color: textPrimary }}
            >
              {tenantName || t("designPage.preview.yourCompany")}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-[14px] font-semibold text-center mb-0.5"
            style={{ color: textPrimary }}
          >
            {t("designPage.loginPagePreview.loginTitle")}
          </h1>
          <p
            className="text-[10px] text-center mb-4"
            style={{ color: textSecondary }}
          >
            {t("designPage.loginPagePreview.loginSubtitle")}
          </p>

          {/* Form fields */}
          <div className="space-y-2.5">
            {/* Email */}
            <div className="space-y-0.5">
              <label
                className="block text-[9px] font-medium"
                style={{ color: textSecondary }}
              >
                {t("designPage.loginPagePreview.email")}
              </label>
              <div
                className="w-full h-7 px-2.5 rounded-md text-[10px] flex items-center"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: isDark ? "#555" : "#999",
                }}
              >
                {t("designPage.loginPagePreview.emailPlaceholder")}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-0.5">
              <label
                className="block text-[9px] font-medium"
                style={{ color: textSecondary }}
              >
                {t("designPage.loginPagePreview.password")}
              </label>
              <div
                className="w-full h-7 px-2.5 rounded-md text-[10px] flex items-center justify-between"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: isDark ? "#555" : "#999",
                }}
              >
                <span>••••••••</span>
                <Eye style={{ width: 10, height: 10, color: textSecondary }} />
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <span
                className="text-[8px]"
                style={{ color: textSecondary }}
              >
                {t("designPage.loginPagePreview.forgotPassword")}
              </span>
            </div>

            {/* Login button */}
            <div
              className="w-full h-[32px] text-[11px] font-semibold flex items-center justify-center"
              style={{
                background: buttonColor,
                color: buttonFg,
                borderRadius: buttonRadius,
              }}
            >
              {t("designPage.loginPagePreview.loginButton")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
