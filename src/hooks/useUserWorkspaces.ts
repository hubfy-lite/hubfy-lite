import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  iconName: string | null;
  iconColor: string | null;
  role: "owner" | "editor";
  plan: "Free" | "Pro";
}

export function useUserWorkspaces() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-workspaces", user?.id],
    queryFn: async (): Promise<Workspace[]> => {
      if (!user) return [];

      // Buscar todos os tenant_users do usuário com join em tenants + tenant_settings
      const { data: memberships, error: memberError } = await supabase
        .from("tenant_users")
        .select("role, tenant_id, tenants(id, name, slug, tenant_settings(icon_url, icon_name, icon_color, plan))")
        .eq("user_id", user.id);

      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) return [];

      // Montar array de workspaces
      return memberships
        .filter((m) => m.tenants) // segurança: só com tenant válido
        .map((m) => {
          const raw = m.tenants as unknown as {
            id: string;
            name: string;
            slug: string;
            tenant_settings: { icon_url: string | null; icon_name: string | null; icon_color: string | null; plan: string | null } | null;
          };
          const ts = raw.tenant_settings ?? { icon_url: null, icon_name: null, icon_color: null, plan: null };
          const rawPlan = ts.plan ?? "free";
          const isPro = rawPlan === "pro" || rawPlan === "business";

          return {
            id: raw.id,
            name: raw.name,
            slug: raw.slug,
            iconUrl: ts.icon_url,
            iconName: ts.icon_name,
            iconColor: ts.icon_color,
            role: m.role as "owner" | "editor",
            plan: isPro ? ("Pro" as const) : ("Free" as const),
          };
        });
    },
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Workspace ativo = o tenant atual do contexto
  const activeWorkspace = data?.find((ws) => ws.id === tenant?.id) ?? null;

  return {
    workspaces: data ?? [],
    activeWorkspace,
    isLoading,
    error: error as Error | null,
  };
}
