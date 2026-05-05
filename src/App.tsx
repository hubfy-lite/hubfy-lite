import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { lazy, Suspense, useEffect } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PageTitleProvider } from "@/contexts/PageTitleContext";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { PageLoader } from "@/components/ui/page-loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { withAppBrand } from "@/lib/page-title";

/* ─── TitleManager — lightweight, only strings ─── */
const TitleManager = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { titleOverride } = usePageTitleContext();

  useEffect(() => {
    const getTitle = (pathname: string) => {
      if (pathname.startsWith("/admin/courses")) return t("nav.courses");
      if (pathname.startsWith("/admin/customers")) return t("nav.customers");
      if (pathname.startsWith("/admin/products")) return t("nav.products");
      if (pathname.startsWith("/admin/orders")) return t("nav.orders");
      if (pathname.startsWith("/admin/design")) return t("nav.design");
      if (pathname.startsWith("/admin/settings")) return t("nav.settings");
      if (pathname.startsWith("/admin/profile")) return t("nav.myProfile");
      if (pathname.startsWith("/admin/showcases")) return t("nav.showcases");
      if (pathname.startsWith("/admin/assets")) return t("nav.myFiles");
      if (pathname.startsWith("/admin/integrations")) return t("nav.integrations");
      if (pathname.startsWith("/admin/new-workspace")) return t("breadcrumb.newWorkspace", "Novo Workspace");
      if (pathname.startsWith("/admin/login")) return t("auth.login.title");
      if (pathname.startsWith("/admin/signup")) return t("auth.signup.title");
      if (pathname.startsWith("/admin/forgot-password")) return t("auth.forgotPassword.title");
      if (pathname.startsWith("/superadmin/dashboard")) return "Dashboard";
      if (pathname.startsWith("/superadmin/tenants")) return "Tenants";
      if (pathname.startsWith("/superadmin/customers")) return "Customers";
      if (pathname.startsWith("/superadmin/orders")) return "Orders";
      if (pathname.startsWith("/superadmin/products")) return "Products";
      if (pathname.startsWith("/superadmin")) return "Superadmin";
      if (pathname.startsWith("/admin")) return t("nav.home");

      if (/^\/[^/]+\/login$/.test(pathname)) return t("portal.meta.login", "Login");
      if (/^\/[^/]+\/forgot-password$/.test(pathname)) return t("auth.forgotPassword.title");
      if (/^\/[^/]+\/store$/.test(pathname)) return t("nav.home");
      if (/^\/[^/]+\/products\/[^/]+(?:\/.*)?$/.test(pathname)) return t("portal.nav.products");

      // /:tenantSlug/:courseSlug — course showcase
      const courseShowcaseMatch = pathname.match(/^\/[^/]+\/([^/]+)$/);
      if (courseShowcaseMatch) {
        const secondSegment = courseShowcaseMatch[1];
        const reservedSecond = new Set(["login", "forgot-password", "store", "portal"]);
        if (!reservedSecond.has(secondSegment)) return t("nav.courses");
      }

      const portalMatch = pathname.match(/^\/[^/]+\/portal(\/.*)?$/);
      if (portalMatch) {
        const sub = portalMatch[1] || "";
        if (sub.startsWith("/profile")) return t("portal.nav.profile");
        if (sub.startsWith("/orders")) return t("portal.nav.orders");
        if (sub.startsWith("/products")) return t("portal.nav.products");
        return t("portal.nav.home");
      }

      const portalRootMatch = pathname.match(/^\/([^/]+)$/);
      if (portalRootMatch) {
        const slug = portalRootMatch[1];
        const reserved = new Set([
          "admin",
          "superadmin",
          "showcases",
          "club",
          "dashboard",
          "login",
          "signup",
          "forgot-password",
          "creator",
        ]);
        if (!reserved.has(slug)) return t("portal.meta.home", "Portal do cliente");
      }

      return "Hubfy";
    };
    document.title = titleOverride ?? withAppBrand(getTitle(location.pathname));
  }, [location.pathname, i18n.language, t, titleOverride]);

  return null;
};

/* ─── Lazy-loaded route groups ─── */

// Auth pages — loaded directly, NO AuthProvider (performance: eliminates waterfall)
const SignupPage = lazy(() => import("@/pages/SignupAnimated"));
const LoginPage = lazy(() => import("@/pages/LoginAnimated"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordAnimated"));


// Single AuthProvider for all authenticated routes (admin + customer)
const AuthenticatedApp = lazy(() => import("@/routes/AuthenticatedApp"));

/* ─── Query client ─── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

/* ─── App ─── */
const AppRoutes = () => {
  const { i18n } = useTranslation();

  const authErrorBoundaryProps = {
    boundaryTag: "auth" as const,
    shouldAutoRetryOnError: (error: Error) =>
      error instanceof DOMException && (error.code === 8 || error.name === "NotFoundError"),
    getErrorContext: () => ({
      tags: {
        route: "auth",
        i18n_language: i18n.language,
        html_lang: document.documentElement.lang || i18n.language,
      },
    }),
  };

  return (
    <Routes>
      {/* ═══ Root — redirect to admin ═══ */}
      <Route path="/" element={<Navigate to="/admin" replace />} />


      {/* ═══ Auth pages — NO AuthProvider, direct lazy load (perf: no waterfall) ═══ */}
      <Route
        path="/admin/signup"
        element={(
          <ErrorBoundary {...authErrorBoundaryProps}>
            <SignupPage basePath="/admin" />
          </ErrorBoundary>
        )}
      />
      <Route
        path="/admin/login"
        element={(
          <ErrorBoundary {...authErrorBoundaryProps}>
            <LoginPage basePath="/admin" />
          </ErrorBoundary>
        )}
      />
      <Route
        path="/admin/forgot-password"
        element={(
          <ErrorBoundary {...authErrorBoundaryProps}>
            <ForgotPasswordPage basePath="/admin" />
          </ErrorBoundary>
        )}
      />

      {/* ═══ Legacy auth redirects ═══ */}
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/signup" element={<Navigate to="/admin/signup" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/admin/forgot-password" replace />} />

      {/* ═══ All other routes — single AuthProvider ═══ */}
      <Route path="/*" element={<AuthenticatedApp />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PageTitleProvider>
            <TitleManager />
            {/* ─── Safety net: captura erros de qualquer rota não coberta ─── */}
            <ErrorBoundary disableAutoRetry onReset={() => window.location.reload()}>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </ErrorBoundary>
          </PageTitleProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
