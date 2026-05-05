import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { X, Loader2, LaptopMinimal, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import BrowserChrome from "@/components/admin/BrowserChrome";
import DesignGeneralTab from "@/components/admin/design/DesignGeneralTab";
import type { DesignGeneralFormData } from "@/components/admin/design/DesignGeneralTab";
import DesignPreview from "@/components/admin/design/DesignPreview";
import DesignLoginPageTab from "@/components/admin/design/DesignLoginPageTab";
import type { DesignLoginPageFormData } from "@/components/admin/design/DesignLoginPageTab";
import DesignLoginPagePreview from "@/components/admin/design/DesignLoginPagePreview";
import DesignPortalTab from "@/components/admin/design/DesignPortalTab";
import type { DesignPortalFormData } from "@/components/admin/design/DesignPortalTab";
import type { PortalProductsTemplate } from "@/components/admin/design/DesignPortalTab";
import DesignPortalPreview from "@/components/admin/design/DesignPortalPreview";
import DesignVideoPlayerTab from "@/components/admin/design/DesignVideoPlayerTab";
import type { DesignVideoPlayerFormData } from "@/components/admin/design/DesignVideoPlayerTab";
import DesignVideoPlayerPreview from "@/components/admin/design/DesignVideoPlayerPreview";
import DesignVideoProtectionCard from "@/components/admin/design/DesignVideoProtectionCard";
import DesignVideoProgressCard from "@/components/admin/design/DesignVideoProgressCard";
import type { DesignMarketingFormData } from "@/components/admin/design/DesignVideoProgressCard";
import { DEFAULT_PORTAL_BG } from "@/components/admin/design/PhotoGalleryModal";
import { ButtonGroup } from "@/components/ui/button-group";
import { DEFAULT_VIDEO_SETTINGS, normalizeVideoSettings } from "@/lib/video-settings";

const DEFAULT_PREVIEW_ASSET_ID = "69de96da0e45fb2cfced7978";
const ENV_PREVIEW_ASSET_ID = import.meta.env.VITE_GUMLET_PREVIEW_ASSET_ID?.trim();
const DESIGN_PREVIEW_ASSET_ID = ENV_PREVIEW_ASSET_ID || DEFAULT_PREVIEW_ASSET_ID;
const DEFAULT_BRAND_COLOR = "#6366f1";
const DEFAULT_DESIGN_TAB = "general";
const DESIGN_TAB_IDS = [
  "general",
  "login-page",
  "portal",
  "video-player",
] as const;
const DESIGN_TAB_LABEL_KEYS: Record<Tab, string> = {
  general: "designPage.tabs.general",
"login-page": "designPage.tabs.loginPage",
  portal: "designPage.tabs.portal",
  "video-player": "designPage.tabs.videoPlayer",
};
const DEFAULT_PORTAL_PRODUCTS_TEMPLATE: PortalProductsTemplate = "gallery_01";

/* ─── Tabs ─── */

type Tab = (typeof DESIGN_TAB_IDS)[number];

function isDesignTab(value: string | null): value is Tab {
  return value !== null && DESIGN_TAB_IDS.includes(value as Tab);
}

function normalizePortalProductsTemplate(
  value: string | null | undefined,
): PortalProductsTemplate {
  return value === DEFAULT_PORTAL_PRODUCTS_TEMPLATE
    ? value
    : DEFAULT_PORTAL_PRODUCTS_TEMPLATE;
}

function getEffectivePortalButtonColor(
  loginPageData: DesignLoginPageFormData,
  brandColor: string,
) {
  return loginPageData.portal_use_brand_colors
    ? brandColor
    : loginPageData.portal_button_color || brandColor;
}

function getDesignPreviewUrl(activeTab: Tab, slug?: string | null) {
  const safeSlug = slug || "minha-loja";

  if (activeTab === "login-page") {
    return `seusite.com/${safeSlug}/login`;
  }

  if (activeTab === "portal") {
    return `seusite.com/${safeSlug}`;
  }

  if (activeTab === "video-player") {
    return "seudominio.com/video_73fs6454dvr592134";
  }

  if (activeTab === "general") {
    return `seusite.com/${safeSlug}/login`;
  }

  return `seusite.com/${safeSlug}/login`;
}

function withDesignTab(searchParams: URLSearchParams, tab: Tab) {
  const next = new URLSearchParams(searchParams);
  next.set("tab", tab);
  return next;
}

/* ─── Main Component ─── */

export default function AdminDesign() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading, updateTenant, refetch } = useTenant();

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => DESIGN_TAB_IDS.map((id) => ({ id, label: t(DESIGN_TAB_LABEL_KEYS[id]) })),
    [t],
  );

  const rawTab = searchParams.get("tab");
  const activeTab = isDesignTab(rawTab) ? rawTab : DEFAULT_DESIGN_TAB;

  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  // Evita que o useEffect resete o formData após auto-save de imagem
  const skipNextTenantEffect = useRef(false);

  // Form state — General
  const [formData, setFormData] = useState<DesignGeneralFormData>({
    icon_url: null,
    icon_name: null,
    icon_color: null,
    primary_color: "#6366f1",
    theme_mode: "light",
    button_style: "pill",
  });

  // Form state — Login Page
  const [loginPageData, setLoginPageData] = useState<DesignLoginPageFormData>({
    portal_use_brand_colors: true,
    portal_theme_mode: "dark",
    portal_bg_image_url: DEFAULT_PORTAL_BG,
    portal_button_color: DEFAULT_BRAND_COLOR,
    portal_button_style: "rounded",
  });
  const [portalData, setPortalData] = useState<DesignPortalFormData>({
    portal_products_template: DEFAULT_PORTAL_PRODUCTS_TEMPLATE,
  });

  // Form state — Video Player
  const [videoData, setVideoData] = useState<DesignVideoPlayerFormData>(DEFAULT_VIDEO_SETTINGS);

  // Form state — Marketing Pixels
  const [marketingData, setMarketingData] = useState<DesignMarketingFormData>({
    facebook_pixel_id: null,
    ga_tracking_id: null,
  });

  useEffect(() => {
    if (rawTab === activeTab) return;
    setSearchParams(withDesignTab(searchParams, activeTab), { replace: true });
  }, [activeTab, rawTab, searchParams, setSearchParams]);

  // Load tenant data into form
  useEffect(() => {
    if (tenant) {
      // Auto-save de imagem: não reseta o form (mudanças pendentes do user seriam perdidas)
      if (skipNextTenantEffect.current) {
        skipNextTenantEffect.current = false;
        return;
      }
      setFormData({
        icon_url: tenant.icon_url || null,
        icon_name: tenant.icon_name || null,
        icon_color: tenant.icon_color || null,
        primary_color: tenant.icon_color || tenant.primary_color || DEFAULT_BRAND_COLOR,
        theme_mode: (tenant.theme_mode === "dark" ? "dark" : "light"),
        button_style: tenant.portal_button_style || "pill",
      });
      setLoginPageData({
        portal_use_brand_colors: tenant.portal_use_brand_colors ?? true,
        portal_theme_mode: (tenant.portal_theme_mode === "light" ? "light" : "dark"),
        portal_bg_image_url: tenant.portal_bg_image_url || DEFAULT_PORTAL_BG,
        portal_button_color: tenant.portal_button_color || tenant.primary_color || DEFAULT_BRAND_COLOR,
        portal_button_style: tenant.portal_button_style || "rounded",
      });
      setPortalData({
        portal_products_template: normalizePortalProductsTemplate(
          tenant.portal_products_template,
        ),
      });
      setVideoData(normalizeVideoSettings(tenant.video_settings));
      setMarketingData({
        facebook_pixel_id: tenant.facebook_pixel_id ?? null,
        ga_tracking_id: tenant.ga_tracking_id ?? null,
      });
    }
  }, [tenant]);

  // Initial data for change detection
  const initialData = useMemo(
    () => ({
      icon_url: tenant?.icon_url || null,
      icon_name: tenant?.icon_name || null,
      icon_color: tenant?.icon_color || null,
      primary_color: tenant?.icon_color || tenant?.primary_color || DEFAULT_BRAND_COLOR,
      theme_mode: (tenant?.theme_mode === "dark" ? "dark" : "light") as "light" | "dark",
      button_style: tenant?.portal_button_style || "pill",
    }),
    [tenant],
  );

  const initialLoginPageData = useMemo(
    () => ({
      portal_use_brand_colors: tenant?.portal_use_brand_colors ?? true,
      portal_theme_mode: (tenant?.portal_theme_mode === "light" ? "light" : "dark") as "light" | "dark",
      portal_bg_image_url: tenant?.portal_bg_image_url || DEFAULT_PORTAL_BG,
      portal_button_color: tenant?.portal_button_color || tenant?.primary_color || DEFAULT_BRAND_COLOR,
      portal_button_style: tenant?.portal_button_style || "rounded",
    }),
    [tenant],
  );

  const initialPortalData = useMemo(
    () => ({
      portal_products_template: normalizePortalProductsTemplate(
        tenant?.portal_products_template,
      ),
    }),
    [tenant],
  );

  const initialVideoData = useMemo(
    () => normalizeVideoSettings(tenant?.video_settings),
    [tenant?.video_settings],
  );

  const initialMarketingData = useMemo(
    () => ({
      facebook_pixel_id: tenant?.facebook_pixel_id ?? null,
      ga_tracking_id: tenant?.ga_tracking_id ?? null,
    }),
    [tenant?.facebook_pixel_id, tenant?.ga_tracking_id],
  );

  const hasChanges = useMemo(() => {
    const generalChanged =
      formData.icon_url !== initialData.icon_url ||
      formData.icon_name !== initialData.icon_name ||
      formData.icon_color !== initialData.icon_color ||
      formData.primary_color !== initialData.primary_color ||
      formData.theme_mode !== initialData.theme_mode ||
      formData.button_style !== initialData.button_style;

    const loginPageChanged =
      loginPageData.portal_use_brand_colors !== initialLoginPageData.portal_use_brand_colors ||
      loginPageData.portal_theme_mode !== initialLoginPageData.portal_theme_mode ||
      loginPageData.portal_bg_image_url !== initialLoginPageData.portal_bg_image_url ||
      loginPageData.portal_button_color !== initialLoginPageData.portal_button_color ||
      loginPageData.portal_button_style !== initialLoginPageData.portal_button_style;

    const portalChanged =
      portalData.portal_products_template !== initialPortalData.portal_products_template;

    const videoChanged =
      JSON.stringify(videoData) !== JSON.stringify(initialVideoData);

    const marketingChanged =
      marketingData.facebook_pixel_id !== initialMarketingData.facebook_pixel_id ||
      marketingData.ga_tracking_id !== initialMarketingData.ga_tracking_id;

    return generalChanged || loginPageChanged || portalChanged || videoChanged || marketingChanged;
  }, [
    formData,
    initialData,
    loginPageData,
    initialLoginPageData,
    portalData,
    initialPortalData,
    videoData,
    initialVideoData,
    marketingData,
    initialMarketingData,
  ]);

  const handleFormChange = (updates: Partial<DesignGeneralFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleLoginPageChange = (updates: Partial<DesignLoginPageFormData>) => {
    setLoginPageData((prev) => ({ ...prev, ...updates }));
  };

  const handlePortalChange = (updates: Partial<DesignPortalFormData>) => {
    setPortalData((prev) => ({ ...prev, ...updates }));
  };

  const handleTabChange = (tab: Tab) => {
    setSearchParams(withDesignTab(searchParams, tab), { replace: true });
  };

  const handleVideoChange = (updates: Partial<DesignVideoPlayerFormData>) => {
    setVideoData((prev) => ({
      ...prev,
      ...updates,
      player: {
        ...prev.player,
        ...(updates.player ?? {}),
        powered_by_gumlet_overlay: false,
      },
    }));
  };

  const handleMarketingChange = (updates: Partial<DesignMarketingFormData>) => {
    setMarketingData((prev) => ({ ...prev, ...updates }));
  };

  // Image upload — auto-persiste no banco sem precisar do botão Salvar
  const handleImageUpload = async (
    file: File,
    field: "icon_url",
  ) => {
    if (!user || !tenant) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("designPage.invalidImage"));
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error(t("designPage.imageTooLarge"));
      return;
    }

    setUploadingIcon(true);
    const previousIconUrl = formData.icon_url;

    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${tenant.id}_icon.${ext}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      handleFormChange({ [field]: url });

      // Persiste imediatamente — flag evita reset do form pelo useEffect
      skipNextTenantEffect.current = true;
      await updateTenant({ icon_url: url });

      toast.success(t("designPage.imageUploaded"));
    } catch (error: unknown) {
      skipNextTenantEffect.current = false;
      handleFormChange({ icon_url: previousIconUrl }); // reverte estado local
      toast.error(translateAppError(error, t("designPage.imageUploadError")));
    } finally {
      setUploadingIcon(false);
    }
  };

  // Background image upload — auto-persiste no banco
  const [uploadingBgImage, setUploadingBgImage] = useState(false);
  const handleBgImageUpload = async (file: File) => {
    if (!user || !tenant) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("designPage.invalidImage"));
      return;
    }

    setUploadingBgImage(true);
    const previousUrl = loginPageData.portal_bg_image_url;

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${tenant.id}_portal_bg.${ext}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      handleLoginPageChange({ portal_bg_image_url: url });

      skipNextTenantEffect.current = true;
      await updateTenant({ portal_bg_image_url: url });

      toast.success(t("designPage.imageUploaded"));
    } catch (error: unknown) {
      skipNextTenantEffect.current = false;
      handleLoginPageChange({ portal_bg_image_url: previousUrl });
      toast.error(translateAppError(error, t("designPage.imageUploadError")));
    } finally {
      setUploadingBgImage(false);
    }
  };

  // Delete de imagem — auto-persiste no banco sem precisar do botão Salvar
  const handleImageDelete = async () => {
    const previousIconUrl = formData.icon_url;
    handleFormChange({ icon_url: null });

    skipNextTenantEffect.current = true;
    try {
      await updateTenant({ icon_url: null });
    } catch (error: unknown) {
      skipNextTenantEffect.current = false;
      handleFormChange({ icon_url: previousIconUrl }); // reverte
      toast.error(translateAppError(error, t("designPage.imageUploadError")));
    }
  };

  // Save
  const handleSave = async () => {
    if (!hasChanges || !tenant) return;
    setSaving(true);

    try {
      const normalizedVideoSettings = normalizeVideoSettings(videoData);
      const videoChanged =
        JSON.stringify(normalizedVideoSettings) !== JSON.stringify(initialVideoData);

      const marketingChanged =
        marketingData.facebook_pixel_id !== initialMarketingData.facebook_pixel_id ||
        marketingData.ga_tracking_id !== initialMarketingData.ga_tracking_id;

      await updateTenant({
        icon_url: formData.icon_url,
        icon_name: formData.icon_name,
        icon_color: formData.icon_color,
        primary_color: formData.icon_color || formData.primary_color,
        theme_mode: formData.theme_mode,
        portal_use_brand_colors: loginPageData.portal_use_brand_colors,
        portal_theme_mode: loginPageData.portal_theme_mode,
        portal_bg_image_url: loginPageData.portal_bg_image_url,
        portal_button_color: loginPageData.portal_use_brand_colors ? null : loginPageData.portal_button_color,
        portal_button_style: loginPageData.portal_button_style,
        portal_products_template: portalData.portal_products_template,
        video_settings: normalizedVideoSettings,
        facebook_pixel_id: marketingData.facebook_pixel_id,
        ga_tracking_id: marketingData.ga_tracking_id,
      });

      if (videoChanged || marketingChanged) {
        const { data: authData } = await supabase.auth.getSession();
        const accessToken = authData.session?.access_token;
        const headers = accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined;

        const { data } = await invokeEdgeFunction<{ success: boolean }>("sync-video-settings", {
          body: { tenant_id: tenant.id },
          headers,
        });

        if (!data?.success) {
          throw new Error(t("designPage.videoPlayer.syncError"));
        }
      }

      toast.success(t("designPage.designSaved"));
    } catch (error: unknown) {
      toast.error(translateEdgeError(error));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => navigate("/admin");
  const brandColor = formData.primary_color || DEFAULT_BRAND_COLOR;
  const portalButtonColor = getEffectivePortalButtonColor(loginPageData, brandColor);
  const effectiveLoginThemeMode = loginPageData.portal_use_brand_colors
    ? formData.theme_mode
    : loginPageData.portal_theme_mode;
  const previewUrl = getDesignPreviewUrl(activeTab, tenant?.slug);

  // Loading
  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col min-h-0 bg-card">
        {/* ─── Header with tabs ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={goBack}>
              <X className="size-4" />
            </Button>
            <span className="text-base font-semibold text-foreground">
              {t("designPage.title")}
            </span>
          </div>

          <nav className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="w-[140px]" />
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Config panel */}
          <div className="w-full lg:w-[540px] shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border p-6 order-1">
            {activeTab === "general" && (
              <DesignGeneralTab
                formData={formData}
                onChange={handleFormChange}
                onImageUpload={handleImageUpload}
                onImageDelete={handleImageDelete}
                uploadingIcon={uploadingIcon}
              />
            )}
            {activeTab === "login-page" && (
              <DesignLoginPageTab
                formData={loginPageData}
                brandColor={brandColor}
                generalThemeMode={formData.theme_mode}
                onChange={handleLoginPageChange}
                onBgImageUpload={handleBgImageUpload}
                uploadingBgImage={uploadingBgImage}
              />
            )}
            {activeTab === "portal" && (
              <DesignPortalTab
                formData={portalData}
                tenantSlug={tenant?.slug ?? ""}
                onChange={handlePortalChange}
              />
            )}
            {activeTab === "video-player" && (
              <>
                <DesignVideoPlayerTab
                  formData={videoData}
                  fallbackColor={formData.primary_color || "#6366f1"}
                  plan={tenant?.plan ?? "free"}
                  onChange={handleVideoChange}
                />
                {tenant && (
                  <DesignVideoProtectionCard
                    tenantId={tenant.id}
                    plan={tenant.plan ?? "free"}
                    videoProtectionEnabled={tenant.video_protection_enabled ?? false}
                    onRefetch={refetch}
                  />
                )}
                {tenant && (
                  <DesignVideoProgressCard
                    tenantId={tenant.id}
                    plan={tenant.plan ?? "free"}
                    progressTrackingEnabled={tenant.video_progress_tracking_enabled ?? false}
                    onRefetch={refetch}
                    formData={marketingData}
                    onChange={handleMarketingChange}
                  />
                )}
              </>
            )}
          </div>

          {/* RIGHT: Preview */}
          <div className="hidden lg:flex flex-1 min-w-0 order-2 flex-col items-center">
            {/* Device toggle */}
            <div className="shrink-0 pt-4 pb-4">
              <ButtonGroup>
                <Button
                  variant={previewMode === "desktop" ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => setPreviewMode("desktop")}
                >
                  <LaptopMinimal className="size-3.5" />
                </Button>
                <Button
                  variant={previewMode === "mobile" ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone className="size-3.5" />
                </Button>
              </ButtonGroup>
            </div>

            {/* Preview frame */}
            <div className="flex-1 min-h-0 w-full flex items-start justify-center px-6 pb-5">
              <div
                style={{
                  width: previewMode === "desktop" ? "min(100%, 820px)" : "320px",
                  aspectRatio: previewMode === "desktop" ? "16 / 11.5" : "9 / 17.5",
                  maxHeight: "100%",
                  transition: "width 550ms cubic-bezier(0.4, 0, 0.2, 1), aspect-ratio 550ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <BrowserChrome url={previewUrl}>
                  <div className="h-full overflow-y-auto">
                    {activeTab === "video-player" ? (
                      <DesignVideoPlayerPreview
                        previewMode={previewMode}
                        videoSettings={videoData}
                        fallbackColor={brandColor}
                      />
                    ) : activeTab === "login-page" ? (
                      <DesignLoginPagePreview
                        iconUrl={formData.icon_url}
                        iconName={formData.icon_name}
                        iconColor={formData.icon_color}
                        brandColor={brandColor}
                        tenantName={tenant?.name ?? ""}
                        previewMode={previewMode}
                        portalThemeMode={effectiveLoginThemeMode}
                        portalBgImageUrl={loginPageData.portal_bg_image_url}
                        portalButtonColor={portalButtonColor}
                        portalButtonStyle={loginPageData.portal_use_brand_colors ? formData.button_style : loginPageData.portal_button_style}
                      />
                    ) : activeTab === "portal" ? (
                      <DesignPortalPreview
                        previewMode={previewMode}
                        themeMode={effectiveLoginThemeMode}
                        radiusStyle={loginPageData.portal_button_style}
                        iconUrl={formData.icon_url}
                        iconName={formData.icon_name}
                        iconColor={formData.icon_color}
                        tenantName={tenant?.name}
                      />
                    ) : activeTab === "general" ? (
                      <DesignLoginPagePreview
                        iconUrl={formData.icon_url}
                        iconName={formData.icon_name}
                        iconColor={formData.icon_color}
                        brandColor={brandColor}
                        tenantName={tenant?.name ?? ""}
                        previewMode={previewMode}
                        portalThemeMode={effectiveLoginThemeMode}
                        portalBgImageUrl={loginPageData.portal_bg_image_url}
                        portalButtonColor={portalButtonColor}
                        portalButtonStyle={formData.button_style}
                      />
                    ) : (
                      <DesignPreview
                        iconUrl={formData.icon_url}
                        iconName={formData.icon_name}
                        iconColor={formData.icon_color}
                        brandColor={brandColor}
                        themeMode={formData.theme_mode}
                        tenantName={tenant?.name ?? ""}
                        previewMode={previewMode}
                      />
                    )}
                  </div>
                </BrowserChrome>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t border-border shrink-0 bg-card">
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button variant="outline" onClick={goBack} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

