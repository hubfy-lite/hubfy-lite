import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CustomerPortalRoute } from "@/components/auth/CustomerPortalRoute";
import { CourseShowcaseRoute } from "@/components/auth/CourseShowcaseRoute";
import { PageLoader } from "@/components/ui/page-loader";

/* ─── Legacy redirect helpers ─── */
function LegacyShowcaseRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/showcases/${slug}`} replace />;
}

function LegacyPortalRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/${slug}`} replace />;
}

/* ─── Lazy-loaded pages ─── */
const ClubShowcasePage = lazy(() => import("@/pages/club/ClubShowcasePage"));


// Tenant public pages
const TenantPublicPage = lazy(() => import("@/pages/tenant/TenantPublicPage"));
const CustomerAuthPage = lazy(() => import("@/pages/tenant/CustomerAuthPage"));
const CustomerForgotPasswordPage = lazy(() => import("@/pages/tenant/CustomerForgotPasswordPage"));
const AdminResetPassword = lazy(() => import("@/pages/admin/AdminResetPassword"));

// Portal do Cliente
const PortalHome = lazy(() => import("@/pages/portal/PortalHome"));
const PortalProductDetail = lazy(() => import("@/pages/portal/PortalProductDetail"));

// Course showcase & lesson (customer-facing)
const CourseShowcasePage = lazy(() => import("@/pages/course/CourseShowcasePage"));
const LessonPage = lazy(() => import("@/pages/course/LessonPage"));

const NotFound = lazy(() => import("@/pages/NotFound"));

/**
 * All non-admin routes: landing, showcases, tenant public pages,
 * customer portal, course showcase, and lessons.
 * AuthProvider is provided by AuthenticatedApp (parent).
 * This chunk is never downloaded by admin-only users.
 */
export default function CustomerRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Landing, /pricing, /terms, /privacy foram hoistados pra App.tsx (fora do AuthProvider). */}


        {/* ── Public showcases ── */}
        <Route path="/showcases/:slug" element={<ClubShowcasePage />} />
        <Route path="/club/:slug" element={<LegacyShowcaseRedirect />} />

        {/* Legacy auth redirects (login, signup, forgot-password) hoisted to App.tsx for perf */}
        {/* Rota legado: links enviados antes da correção apontavam para /reset-password.
            Renderiza o componente diretamente (sem redirect) para preservar o hash do Supabase. */}
        <Route path="/reset-password" element={<AdminResetPassword />} />

        {/* ── Legacy /creator routes ── */}
        <Route path="/creator/*" element={<NotFound />} />

        {/* ── Legacy /dashboard redirect ── */}
        <Route path="/dashboard" element={<Navigate to="/admin" replace />} />

        {/* ═══ Tenant public pages ═══ */}
        <Route path="/:slug/store" element={<TenantPublicPage />} />
        <Route path="/:slug/login" element={<CustomerAuthPage />} />
        <Route path="/:slug/forgot-password" element={<CustomerForgotPasswordPage />} />

        {/* ═══ Customer Portal ═══ */}
        <Route
          path="/:slug"
          element={
            <CustomerPortalRoute>
              <PortalHome />
            </CustomerPortalRoute>
          }
        />
        <Route
          path="/:slug/products/:productId"
          element={
            <CustomerPortalRoute>
              <PortalProductDetail />
            </CustomerPortalRoute>
          }
        />
        <Route path="/:slug/portal" element={<LegacyPortalRedirect />} />
        <Route path="/:slug/portal/*" element={<LegacyPortalRedirect />} />

        {/* ═══ Lesson Page (protected — /:tenant/:course/:lesson) ═══ */}
        <Route
          path="/:tenantSlug/:courseSlug/:lessonId"
          element={
            <CourseShowcaseRoute>
              <LessonPage />
            </CourseShowcaseRoute>
          }
        />

        {/* ═══ Course Showcase (protected — /:tenant/:course) ═══ */}
        <Route
          path="/:tenantSlug/:courseSlug"
          element={
            <CourseShowcaseRoute>
              <CourseShowcasePage />
            </CourseShowcaseRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
