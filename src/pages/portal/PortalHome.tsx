import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/contexts/PortalContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalProducts } from "@/hooks/usePortalProducts";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ProductGallery01 } from "@/components/ProductGallery01";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import { joinTitleSegments } from "@/lib/page-title";
import { TenantPublicFooter } from "@/components/tenant/TenantPublicFooter";
import { LIGHT_VARS, DARK_VARS } from "@/lib/showcase-theme";
import { CustomerPortalHeader } from "@/components/portal/CustomerPortalHeader";
import { useTheme } from "@/contexts/ThemeContext";

const PORTAL_PRODUCT_FALLBACK = "/images/placeholders/product-portal-fallback.svg";

export default function PortalHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { tenant, slug, accessRole, customer } = usePortal();
  usePageTitle(joinTitleSegments(t("portal.meta.home", "Portal do cliente"), tenant.name));
  const { data: products = [], isLoading } = usePortalProducts({
    tenantId: tenant.id,
    accessRole,
  });
  const { data: tenantFooter } = useQuery({
    queryKey: ["portal-tenant-footer", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("tenant_settings(social_links, icon_name, icon_color, icon_url)")
        .eq("id", tenant.id)
        .maybeSingle();

      if (error) {
        return null;
      }

      return data as {
        tenant_settings?: {
          social_links?: Record<string, string> | null;
          icon_name?: string | null;
          icon_color?: string | null;
          icon_url?: string | null;
        } | null;
      } | null;
    },
    enabled: !!tenant.id,
  });

  const galleryItems = useMemo(
    () =>
      products.map((product) => {
        const imageSrc =
          (product.coverUrl
            ? getCoversOptimizedUrl(product.coverUrl, "product-card", product.updatedAt)
            : null) || PORTAL_PRODUCT_FALLBACK;

        return {
          id: product.id,
          title: product.name,
          description: product.description ||
            (product.benefit === "courses"
              ? t("portal.home.fallbackShowcaseDescription")
              : product.benefit === "files"
              ? t("portal.home.fallbackFilesDescription")
              : product.benefit === "links"
              ? t("portal.home.fallbackLinksDescription")
              : ""),
          badge: product.benefit === "courses"
            ? t("products.deliverableTypes.course")
            : product.benefit === "files"
            ? t("products.deliverableTypes.file")
            : product.benefit === "links"
            ? t("products.deliverableTypes.link")
            : null,
          badgeVariant: product.benefit === "courses"
            ? "blue"
            : product.benefit === "files"
            ? "purple"
            : product.benefit === "links"
            ? "green"
            : undefined,
          imageSrc,
          muted: !product.hasAccess,
          onClick: product.hasAccess
            ? () => {
                if (product.benefit === "courses" && product.courseSlug) {
                  navigate(`/${slug}/${product.courseSlug}`);
                } else {
                  navigate(`/${slug}/products/${product.public_id}`);
                }
              }
            : undefined,
        };
      }),
    [products, t, navigate, slug]
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate(`/${slug}/login`, { replace: true });
  }, [signOut, navigate, slug]);

  const { theme: globalTheme } = useTheme();
  const portalTheme = globalTheme;
  const isDark = portalTheme === "dark";
  const themeColors = useMemo(
    () => ({
      bg: isDark ? "#0A0A0A" : "#FFFFFF",
      textSecondary: isDark ? "#A0A0A0" : "#666666",
    }),
    [isDark]
  );
  const galleryRadiusClass =
    tenant.portal_button_style === "rectangular"
      ? "rounded-none"
      : tenant.portal_button_style === "pill"
        ? "rounded-[20px]"
        : "rounded-[8px]";

  return (
    <main
      className="flex min-h-screen flex-col"
      style={{
        ...(isDark ? DARK_VARS : LIGHT_VARS),
        background: themeColors.bg,
      }}
    >
      <CustomerPortalHeader
        tenantName={tenant.name}
        tenantSlug={slug}
        tenantIconUrl={tenantFooter?.tenant_settings?.icon_url ?? tenant.icon_url}
        tenantIconName={tenantFooter?.tenant_settings?.icon_name}
        tenantIconColor={tenantFooter?.tenant_settings?.icon_color}
        onSignOut={handleSignOut}
        userId={profile?.id}
      />

      <section className="flex-1 px-4 pb-20 md:px-8 md:pb-24">
        <div className="mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px]">
          {isLoading ? (
            <div
              className="flex min-h-[420px] w-full items-center justify-center"
              style={{ color: themeColors.textSecondary }}
            >
              <Loader2 className="size-7 animate-spin" />
            </div>
          ) : (
            <ProductGallery01
              title={
                (customer?.name ?? profile?.name)
                  ? t("portal.home.titleWithName", { name: (customer?.name ?? profile?.name)!.split(" ")[0] })
                  : t("portal.home.title")
              }
              description={t("portal.home.subtitle")}
              descriptionColor={themeColors.textSecondary}
              items={galleryItems}
              emptyState={<p className="text-sm">{t("portal.home.empty")}</p>}
              radiusClass={galleryRadiusClass}
              themeMode={portalTheme}
            />
          )}
        </div>
      </section>

      <TenantPublicFooter
        tenantName={tenant.name}
        socialLinks={tenantFooter?.tenant_settings?.social_links ?? null}
      />
    </main>
  );
}
