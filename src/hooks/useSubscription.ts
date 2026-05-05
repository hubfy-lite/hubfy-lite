import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";

export interface Subscription {
  id: string;
  tenant_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["subscription", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const isActive = subscription?.status === "active";
  const isPastDue = subscription?.status === "past_due";
  const isCanceled = subscription?.status === "canceled";
  const willCancel = subscription?.cancel_at_period_end === true;

  return {
    subscription: subscription ?? null,
    isActive,
    isPastDue,
    isCanceled,
    willCancel,
    plan: null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
