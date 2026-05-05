import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBySlug, type PublicTenant } from "@/hooks/useTenantBySlug";
import { useCustomerByTenant, type PortalCustomer } from "@/hooks/useCustomerByTenant";

export type PortalAccessRole = "customer" | "tenant_user";

interface PortalContextType {
  tenant: PublicTenant;
  customer: PortalCustomer | null;
  slug: string;
  accessRole: PortalAccessRole;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

interface PortalProviderProps {
  children: ReactNode;
  tenant: PublicTenant;
  customer: PortalCustomer | null;
  accessRole: PortalAccessRole;
}

export function PortalProvider({ children, tenant, customer, accessRole }: PortalProviderProps) {
  const { slug } = useParams<{ slug: string }>();

  return (
    <PortalContext.Provider value={{ tenant, customer, slug: slug!, accessRole }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (context === undefined) {
    throw new Error("usePortal must be used within a PortalProvider");
  }
  return context;
}

/**
 * Hook que resolve tenant + customer a partir da URL e do user logado.
 * Usado pelo CustomerPortalRoute para decidir se renderiza o portal ou redireciona.
 */
export function usePortalResolver(slug: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantQuery = useTenantBySlug(slug);
  const customerQuery = useCustomerByTenant(tenantQuery.data?.id);

  // ── resolve_portal_customer: vincular customer órfão ao auth.user ──
  const resolveAttempted = useRef(false);
  const shouldResolve =
    !!slug &&
    !!user?.id &&
    !!tenantQuery.data?.id &&
    customerQuery.isFetched &&
    !customerQuery.data &&
    !resolveAttempted.current;

  useEffect(() => {
    if (!shouldResolve) return;
    resolveAttempted.current = true;

    supabase
      .rpc("resolve_portal_customer", { p_tenant_slug: slug! })
      .then(
        ({ data }) => {
          if (data) {
            // Customer órfão vinculado — re-fetch
            queryClient.invalidateQueries({ queryKey: ["portal-customer"] });
          }
        },
        () => {},
      );
  }, [shouldResolve, slug, queryClient]);

  const shouldCheckTenantMembership =
    !!tenantQuery.data?.id &&
    !!user?.id;

  const tenantUserQuery = useQuery({
    queryKey: ["portal-tenant-user-membership", tenantQuery.data?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("tenant_id", tenantQuery.data!.id)
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },
    enabled: shouldCheckTenantMembership,
    staleTime: 30_000,
  });

  const isTenantUser = tenantUserQuery.data ?? false;
  const accessRole: PortalAccessRole | null = isTenantUser
    ? "tenant_user"
    : customerQuery.data
      ? "customer"
      : null;

  return {
    tenant: tenantQuery.data ?? null,
    customer: customerQuery.data ?? null,
    isTenantUser,
    accessRole,
    isLoading:
      tenantQuery.isLoading ||
      customerQuery.isLoading ||
      tenantUserQuery.isLoading,
    tenantError: tenantQuery.error,
    customerError: customerQuery.error,
    tenantUserError: tenantUserQuery.error,
  };
}
