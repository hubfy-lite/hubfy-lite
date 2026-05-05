import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";
import { getPublicSiteUrl } from "@/lib/public-site-url";

export interface TeamMember {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: string;
}

export interface AddTeamMemberData {
  email: string;
  role?: "editor" | "owner";
}

export function useTeamMembers() {
  const { tenant, loading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  const tenantId = tenant?.id ?? null;

  const {
    data: members = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["team-members", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.rpc("get_team_members", {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });

  const addMember = async (input: AddTeamMemberData) => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    setActionLoading(true);
    try {
      const { data } = await invokeEdgeFunction("add-team-member", {
        body: {
          tenant_id: tenantId,
          email: input.email,
          role: input.role || "editor",
          origin: getPublicSiteUrl(),
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
      return data;
    } finally {
      setActionLoading(false);
    }
  };

  const resendInvite = async (userId: string) => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    setActionLoading(true);
    try {
      const { data } = await invokeEdgeFunction("resend-team-invite", {
        body: {
          tenant_id: tenantId,
          user_id: userId,
          origin: getPublicSiteUrl(),
        },
      });

      return data;
    } finally {
      setActionLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    setActionLoading(true);
    try {
      const { data } = await invokeEdgeFunction("remove-team-member", {
        body: {
          tenant_id: tenantId,
          user_id: userId,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
      return data;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    members,
    loading: tenantLoading || isLoading,
    actionLoading,
    error: error as Error | null,
    refetch,
    addMember,
    resendInvite,
    removeMember,
  };
}
