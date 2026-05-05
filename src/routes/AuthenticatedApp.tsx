import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UploadProvider } from "@/contexts/UploadContext";
import { UploadToast } from "@/components/admin/UploadToast";
import { PageLoader } from "@/components/ui/page-loader";

const SuperadminRoutes = lazy(() => import("@/routes/SuperadminRoutes"));
const AdminRoutes = lazy(() => import("@/routes/AdminRoutes"));
const CustomerRoutes = lazy(() => import("@/routes/CustomerRoutes"));

/**
 * Single AuthProvider for the entire app (except public course page).
 * Admin and Customer route groups are lazy-loaded as separate chunks.
 */
export default function AuthenticatedApp() {
  return (
    <AuthProvider>
      <UploadProvider>
        <UploadToast />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/superadmin/*" element={<SuperadminRoutes />} />
            <Route path="/admin/*" element={<AdminRoutes />} />
            <Route path="/*" element={<CustomerRoutes />} />
          </Routes>
        </Suspense>
      </UploadProvider>
    </AuthProvider>
  );
}
