import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageLoader } from "@/components/ui/page-loader";

const SuperadminDashboard = lazy(() => import("@/pages/superadmin/SuperadminDashboard"));
const SuperadminTenants = lazy(() => import("@/pages/superadmin/SuperadminTenants"));
const SuperadminCustomers = lazy(() => import("@/pages/superadmin/SuperadminCustomers"));
const SuperadminOrders = lazy(() => import("@/pages/superadmin/SuperadminOrders"));
const SuperadminProducts = lazy(() => import("@/pages/superadmin/SuperadminProducts"));
const SuperadminSellers = lazy(() => import("@/pages/superadmin/SuperadminSellers"));
const SuperadminUsers = lazy(() => import("@/pages/superadmin/SuperadminUsers"));

export default function SuperadminRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <SuperadminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <SuperadminTenants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <SuperadminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <SuperadminCustomers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <SuperadminOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <SuperadminProducts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sellers"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <SuperadminSellers />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/superadmin/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
