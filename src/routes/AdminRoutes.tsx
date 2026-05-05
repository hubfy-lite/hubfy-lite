import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageLoader } from "@/components/ui/page-loader";

/* ─── Lazy-loaded pages ─── */

// Layout
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));

// Admin pages (with sidebar)
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminCourses = lazy(() => import("@/pages/admin/AdminCourses"));
const AdminCourseNew = lazy(() => import("@/pages/admin/AdminCourseNew"));
const AdminCourseStructure = lazy(() => import("@/pages/admin/AdminCourseStructure"));
const AdminModuleNew = lazy(() => import("@/pages/admin/AdminModuleNew"));
const AdminLessonNew = lazy(() => import("@/pages/admin/AdminLessonNew"));
const AdminCustomers = lazy(() => import("@/pages/admin/AdminCustomers"));
const AdminCustomerDetail = lazy(() => import("@/pages/admin/AdminCustomerDetail"));
const AdminCustomerImport = lazy(() => import("@/pages/admin/AdminCustomerImport"));
const AdminContactImport = lazy(() => import("@/pages/admin/AdminContactImport"));
const AdminProducts = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminProductEdit = lazy(() => import("@/pages/admin/AdminProductEdit"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminOrderDetail = lazy(() => import("@/pages/admin/AdminOrderDetail"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminProfile = lazy(() => import("@/pages/admin/AdminProfile"));
const AdminAssets = lazy(() => import("@/pages/admin/AdminAssets"));
const AdminAssetDetail = lazy(() => import("@/pages/admin/AdminAssetDetail"));
const AdminShowcases = lazy(() => import("@/pages/admin/AdminShowcases"));
const AdminIntegrations = lazy(() => import("@/pages/admin/AdminIntegrations"));
const AdminSeller = lazy(() => import("@/pages/admin/AdminSeller"));
// Full-screen pages (no sidebar)
const AdminLessonEdit = lazy(() => import("@/pages/admin/AdminLessonEdit"));
const AdminDesign = lazy(() => import("@/pages/admin/AdminDesign"));
const AdminIntegrationEdit = lazy(() => import("@/pages/admin/AdminIntegrationEdit"));
const AdminVimeoIntegration = lazy(() => import("@/pages/admin/AdminVimeoIntegration"));
const AdminPandaVideoIntegration = lazy(() => import("@/pages/admin/AdminPandaVideoIntegration"));
const AdminWistiaIntegration = lazy(() => import("@/pages/admin/AdminWistiaIntegration"));

// Auth / onboarding (no sidebar)
const AdminCompleteProfile = lazy(() => import("@/pages/admin/AdminCompleteProfile"));
const AdminNewWorkspace = lazy(() => import("@/pages/admin/AdminNewWorkspace"));
const AcceptInvite = lazy(() => import("@/pages/admin/AcceptInvite"));
const AdminResetPassword = lazy(() => import("@/pages/admin/AdminResetPassword"));
const AdminSetPassword = lazy(() => import("@/pages/admin/AdminSetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));

/**
 * All /admin/* routes.
 * AuthProvider is provided by AuthenticatedApp (parent).
 * This chunk is never downloaded by customers.
 */
export default function AdminRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
          {/* Auth pages (login, signup, forgot-password) are hoisted to App.tsx for perf */}
          <Route path="/reset-password" element={<AdminResetPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* ── Set Password (first-time signup without password) ── */}
          <Route
            path="/set-password"
            element={
              <ProtectedRoute skipPasswordCheck skipProfileCheck skipWorkspaceCheck>
                <AdminSetPassword />
              </ProtectedRoute>
            }
          />

          {/* ── Complete Profile (skips profile + workspace check) ── */}
          <Route
            path="/complete-profile"
            element={
              <ProtectedRoute skipProfileCheck skipWorkspaceCheck>
                <AdminCompleteProfile />
              </ProtectedRoute>
            }
          />

          {/* ── New Workspace (skips workspace check) ── */}
          <Route
            path="/new-workspace"
            element={
              <ProtectedRoute skipWorkspaceCheck>
                <AdminNewWorkspace />
              </ProtectedRoute>
            }
          />

          {/* ── Full-screen editors (protected, no sidebar) ── */}
          <Route
            path="/courses/:courseId/lessons/:lessonId"
            element={
              <ProtectedRoute>
                <AdminLessonEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/design"
            element={
              <ProtectedRoute>
                <AdminDesign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations/vimeo"
            element={
              <ProtectedRoute>
                <AdminVimeoIntegration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations/pandavideo"
            element={
              <ProtectedRoute>
                <AdminPandaVideoIntegration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations/wistia"
            element={
              <ProtectedRoute>
                <AdminWistiaIntegration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations/:provider"
            element={
              <ProtectedRoute>
                <AdminIntegrationEdit />
              </ProtectedRoute>
            }
          />

          {/* ── Layout route: sidebar pages ── */}
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="/courses" element={<AdminCourses />} />
            <Route path="/courses/new" element={<AdminCourseNew />} />
            <Route path="/courses/:courseId" element={<AdminCourseStructure />} />
            <Route path="/courses/:courseId/modules/new" element={<AdminModuleNew />} />
            <Route path="/courses/:courseId/modules/:moduleId/lessons/new" element={<AdminLessonNew />} />
            <Route path="/content" element={<Navigate to="/admin/courses" replace />} />
            <Route path="/customers" element={<AdminCustomers />} />
            <Route path="/customers/import" element={<AdminCustomerImport />} />
            <Route path="/customers/import-contacts" element={<AdminContactImport />} />
            <Route path="/customers/:customerId" element={<AdminCustomerDetail />} />
            <Route path="/settings" element={<Navigate to="/admin/settings/general" replace />} />
            <Route path="/settings/:tab" element={<AdminSettings />} />
            <Route path="/profile" element={<Navigate to="/admin/profile/profile" replace />} />
            <Route path="/profile/:tab" element={<AdminProfile />} />
            <Route path="/assets" element={<AdminAssets />} />
            <Route path="/assets/:assetId" element={<AdminAssetDetail />} />
            <Route path="/showcases" element={<AdminShowcases />} />
            <Route path="/products" element={<AdminProducts />} />
            <Route path="/products/:productId" element={<AdminProductEdit />} />
            <Route path="/orders" element={<AdminOrders />} />
            <Route path="/orders/:orderId" element={<AdminOrderDetail />} />
            <Route path="/integrations" element={<AdminIntegrations />} />
            <Route path="/create-seller" element={<AdminSeller />} />
          </Route>

          {/* Catch-all inside /admin */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
  );
}
