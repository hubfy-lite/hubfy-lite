import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Lightweight check: does the current user belong to at least one workspace?
 * Returns { hasWorkspace, loading } — never depends on tenant resolution.
 */
export function useHasWorkspace() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["has-workspace", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count, error } = await supabase
        .from("tenant_users")
        .select("tenant_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .limit(1);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    hasWorkspace: data ?? false,
    loading: !!user && isLoading,
  };
}
