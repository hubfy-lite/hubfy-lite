import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useHasWorkspace } from "@/hooks/useHasWorkspace";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ("admin" | "tenant" | "customer")[];
  /**
   * Para este projeto, o fluxo principal é do creator.
   * Se o usuário não estiver logado, redirecionamos para este path.
   */
  redirectTo?: string;
  /**
   * Se true, não redireciona para /admin/complete-profile (usado na própria página)
   */
  skipProfileCheck?: boolean;
  /**
   * Se true, não redireciona para /admin/new-workspace (usado na própria página)
   */
  skipWorkspaceCheck?: boolean;
  /**
   * Se true, não redireciona para /admin/set-password (usado na própria página)
   */
  skipPasswordCheck?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = "/admin/login",
  skipProfileCheck = false,
  skipWorkspaceCheck = false,
  skipPasswordCheck = false,
}: ProtectedRouteProps) {
  const { user, loading, roles, rolesError, profile, profileLoading } = useAuth();
  const { tenant, loading: tenantLoading, isFetching: tenantFetching } = useTenant();
  const { hasWorkspace, loading: hasWsLoading } = useHasWorkspace();
  const location = useLocation();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Erro ao carregar roles: mostra retry explícito em vez de conceder acesso
  // com role errada. O botão "Tentar novamente" faz reload (reusa o boot).
  if (rolesError && user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-6">
        <div className="flex flex-col gap-4 max-w-md">
          <AlertTriangle className="size-8 text-foreground" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold text-foreground tracking-normal">
              {t("rolesError.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("rolesError.description")}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={() => window.location.reload()}>
              {t("rolesError.retry")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              {t("rolesError.back")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Customers can NEVER access /admin routes
  const isOnlyCustomer = roles.length > 0 && roles.every((r) => r === "customer");
  if (isOnlyCustomer && location.pathname.startsWith("/admin")) {
    return <Navigate to="/" replace />;
  }

  // Check required roles (before workspace check)
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => roles.includes(role));
    if (!hasRequiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  // Redirect to set-password if user signed up without a password
  if (
    !skipPasswordCheck &&
    user.user_metadata?.needs_password &&
    location.pathname !== "/admin/set-password"
  ) {
    return <Navigate to="/admin/set-password" replace />;
  }

  // Wait for profile to load before checking completeness
  if (!skipProfileCheck && roles.includes("tenant") && profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to complete-profile if tenant user hasn't filled whatsapp yet
  if (
    !skipProfileCheck &&
    roles.includes("tenant") &&
    profile &&
    !profile.whatsapp &&
    location.pathname !== "/admin/complete-profile"
  ) {
    return <Navigate to="/admin/complete-profile" replace />;
  }

  // Pages that skip the workspace check (e.g. /admin/new-workspace) don't need
  // the active tenant — never block them on tenant resolution.
  if (!skipWorkspaceCheck) {
    // Wait for tenant resolution before deciding redirect.
    const resolvingTenant = tenantLoading || (roles.includes("tenant") && tenantFetching && !tenant);
    if (resolvingTenant) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
  }

  // Redirect to new-workspace if user has no workspace at all.
  // Uses a dedicated membership check — not the active-tenant query, which can
  // be null for many reasons (loading, stale default_workspace_id, etc.).
  if (!skipWorkspaceCheck && roles.includes("tenant")) {
    if (hasWsLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (!hasWorkspace) {
      return <Navigate to="/admin/new-workspace" replace />;
    }
  }

  return <>{children}</>;
}
