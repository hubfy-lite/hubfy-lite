import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Download, ExternalLink, ArrowLeft, FileIcon, Link2, ShieldX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useProductAccess } from "@/hooks/useProductAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/contexts/PortalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { CustomerPortalHeader } from "@/components/portal/CustomerPortalHeader";
import { TenantPublicFooter } from "@/components/tenant/TenantPublicFooter";
import { LIGHT_VARS, DARK_VARS } from "@/lib/showcase-theme";

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalProductDetail() {
  const { t } = useTranslation();
  const { slug, productId: productPublicId } = useParams<{ slug: string; productId: string }>();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { tenant, slug: portalSlug, accessRole } = usePortal();

  // Resolve public_id → UUID
  const { data: resolvedProduct, isLoading: resolveLoading } = useQuery({
    queryKey: ["portal-product-resolve", productPublicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id")
        .eq("public_id", productPublicId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!productPublicId,
  });
  const resolvedProductId = resolvedProduct?.id;

  const { data, isLoading, error } = useProductAccess(resolvedProductId);
  const { data: hasAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["portal-product-detail-access", resolvedProductId, accessRole],
    queryFn: async () => {
      if (!resolvedProductId) return false;
      if (accessRole === "tenant_user") return true;

      const { data, error } = await supabase.rpc("get_customer_purchased_products");
      if (error) return false;

      return (data ?? []).some((item) => item.product_id === resolvedProductId);
    },
    enabled: !!resolvedProductId && !!accessRole,
  });

  // Tenant footer settings (mesmo padrão do PortalHome)
  const { data: tenantFooter } = useQuery({
    queryKey: ["portal-tenant-footer", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("tenant_settings(social_links, icon_name, icon_color, icon_url)")
        .eq("id", tenant.id)
        .maybeSingle();
      if (error) return null;
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

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate(`/${slug}/login`, { replace: true });
  }, [signOut, navigate, slug]);

  // Tema (mesmo padrão do PortalHome)
  const { theme: globalTheme } = useTheme();
  const isDark = globalTheme === "dark";
  const themeColors = useMemo(
    () => ({
      bg: isDark ? "#0A0A0A" : "#FFFFFF",
      textSecondary: isDark ? "#A0A0A0" : "#666666",
    }),
    [isDark]
  );

  const allLoading = isLoading || accessLoading || resolveLoading;

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
        tenantSlug={portalSlug}
        tenantIconUrl={tenantFooter?.tenant_settings?.icon_url ?? tenant.icon_url}
        tenantIconName={tenantFooter?.tenant_settings?.icon_name}
        tenantIconColor={tenantFooter?.tenant_settings?.icon_color}
        onSignOut={handleSignOut}
        userId={profile?.id}
      />

      <section className="flex-1 px-4 pb-20 md:px-8 md:pb-24">
        <div className="mx-auto w-full max-w-3xl space-y-6 pt-6">
          {/* Voltar */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => navigate(`/${slug}`)}
          >
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Button>

          {allLoading ? (
            <div
              className="flex justify-center py-12"
              style={{ color: themeColors.textSecondary }}
            >
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : !hasAccess ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <ShieldX className="size-10" style={{ color: themeColors.textSecondary }} />
              <p style={{ color: themeColors.textSecondary }}>
                {t("portal.accessDenied.loginNoAccess")}
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p style={{ color: themeColors.textSecondary }}>{t("common.unexpectedError")}</p>
            </div>
          ) : (
            <>
              {/* Arquivos para download */}
              {data?.benefit === "files" && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("portal.productDetail.filesTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.assets.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {t("portal.productDetail.noFiles")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.assets.map((asset) => (
                          <div
                            key={asset.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileIcon className="size-5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {asset.file_name}
                                </p>
                                {asset.file_size && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(asset.file_size)}
                                  </p>
                                )}
                              </div>
                            </div>
                            {asset.signedUrl && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={asset.signedUrl} download={asset.file_name}>
                                  <Download className="size-4" />
                                  <span className="hidden sm:inline ml-2">
                                    {t("portal.productDetail.download")}
                                  </span>
                                </a>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Acesso à vitrine */}
              {data?.showcase && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("portal.productDetail.showcaseTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {data.showcase.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("portal.productDetail.showcaseHint")}
                        </p>
                      </div>
                      <Button asChild>
                        <a
                          href={`/showcases/${data.showcase.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4" />
                          <span className="ml-2">
                            {t("portal.productDetail.accessShowcase")}
                          </span>
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Links externos */}
              {data?.benefit === "links" && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("portal.productDetail.linksTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.links.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {t("portal.productDetail.noLinks")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.links.map((link) => (
                          <div
                            key={link.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Link2 className="size-5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {link.title}
                                </p>
                                {link.description && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {link.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <a href={link.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-4" />
                                <span className="hidden sm:inline ml-2">
                                  {t("portal.productDetail.openLink")}
                                </span>
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sem conteúdo */}
              {!data?.assets.length && !data?.showcase && !data?.links.length && (
                <div className="text-center py-12">
                  <p style={{ color: themeColors.textSecondary }}>
                    {t("portal.productDetail.noContent")}
                  </p>
                </div>
              )}
            </>
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
