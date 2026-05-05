import { Navigate, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldX, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalResolver, PortalProvider } from "@/contexts/PortalContext";
import { Button } from "@/components/ui/button";
import { SetPasswordDialog } from "@/components/portal/SetPasswordDialog";
import { supabase } from "@/integrations/supabase/client";

interface CustomerPortalRouteProps {
  children: React.ReactNode;
}

export function CustomerPortalRoute({ children }: CustomerPortalRouteProps) {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const { tenant, customer, accessRole, isLoading: portalLoading } = usePortalResolver(slug);

  /* ── Loading ── */
  if (authLoading || portalLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ── Não logado → redirect para login do tenant ── */
  if (!user) {
    return (
      <Navigate
        to={`/${slug}/login`}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  /* ── Tenant não encontrado ── */
  if (!tenant) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("tenant.notFound")}
        </h1>
        <p className="text-muted-foreground">{t("tenant.notFoundHint")}</p>
      </div>
    );
  }

  /* ── Logado mas sem acesso ao portal deste tenant ── */
  if (!accessRole) {
    const handleSignOutAndRetry = async () => {
      await supabase.auth.signOut();
      window.location.href = `/${slug}/login`;
    };

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background gap-6 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldX className="size-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">
            {t("portal.accessDenied.title")}
          </h1>
          <p className="text-muted-foreground max-w-md">
            {t("portal.accessDenied.noPurchase")}
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            {t("portal.accessDenied.tryOtherEmail")}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={handleSignOutAndRetry} className="w-full gap-2">
            <LogOut className="size-4" />
            {t("portal.accessDenied.signOutRetry")}
          </Button>
          <Button variant="outline" asChild className="w-full">
            <a href={`/${slug}/store`}>{t("portal.accessDenied.backToStore")}</a>
          </Button>
        </div>
      </div>
    );
  }

  /* ── Tudo OK → renderiza portal ── */
  return (
    <PortalProvider tenant={tenant} customer={customer} accessRole={accessRole}>
      {accessRole === "customer" && <SetPasswordDialog />}
      {children}
    </PortalProvider>
  );
}
