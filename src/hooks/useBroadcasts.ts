import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";
import type { Database } from "@/integrations/supabase/types";

export interface Broadcast {
  id: string;
  tenant_id: string;
  resend_broadcast_id: string | null;
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  html: string;
  editor_state: unknown;
  segment_filter: Record<string, unknown>;
  recipient_count: number;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

type EmailBroadcastInsert = Database["public"]["Tables"]["email_broadcasts"]["Insert"];
type EmailBroadcastUpdate = Database["public"]["Tables"]["email_broadcasts"]["Update"];

export function useBroadcasts() {
  const { tenant } = useTenant();

  const { data, isLoading, error } = useQuery({
    queryKey: ["broadcasts", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_broadcasts")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Broadcast[];
    },
    enabled: !!tenant?.id,
    staleTime: 10_000,
  });

  return {
    broadcasts: data ?? [],
    loading: isLoading,
    error,
  };
}

export function useBroadcast(broadcastId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["broadcast", broadcastId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_broadcasts")
        .select("*")
        .eq("id", broadcastId!)
        .single();

      if (error) throw error;
      return data as Broadcast;
    },
    enabled: !!broadcastId,
    staleTime: 5_000,
  });

  return { broadcast: data ?? null, loading: isLoading, error };
}

export function useBroadcastMutations() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["broadcasts", tenant?.id] });

  const createBroadcast = useMutation({
    mutationFn: async (params: {
      subject?: EmailBroadcastInsert["subject"];
      html?: EmailBroadcastInsert["html"];
      from_name?: EmailBroadcastInsert["from_name"];
      from_email?: EmailBroadcastInsert["from_email"];
      reply_to?: NonNullable<EmailBroadcastInsert["reply_to"]>;
    } = {}) => {
      const { data, error } = await supabase
        .from("email_broadcasts")
        .insert({
          tenant_id: tenant!.id,
          subject: params.subject ?? "",
          from_name: params.from_name ?? "",
          from_email: params.from_email ?? "",
          reply_to: params.reply_to ?? null,
          html: params.html ?? "",
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateBroadcast = useMutation({
    mutationFn: async (params: {
      id: string;
      subject?: EmailBroadcastUpdate["subject"];
      html?: EmailBroadcastUpdate["html"];
      from_name?: EmailBroadcastUpdate["from_name"];
      from_email?: EmailBroadcastUpdate["from_email"];
      reply_to?: EmailBroadcastUpdate["reply_to"];
      editor_state?: EmailBroadcastUpdate["editor_state"];
      segment_filter?: EmailBroadcastUpdate["segment_filter"];
    }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from("email_broadcasts")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast", vars.id] });
      invalidate();
    },
  });

  const deleteBroadcast = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_broadcasts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createBroadcast, updateBroadcast, deleteBroadcast };
}

export function useSendBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const { data } = await invokeEdgeFunction("email-marketing-send", {
        body: { broadcast_id: broadcastId },
      });
      return data;
    },
    onSuccess: (_, broadcastId) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast", broadcastId] });
      queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
    },
  });
}

export function useSubscribedCustomerCount() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ["subscribed-customer-count", tenant?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant!.id)
        .eq("email_marketing_status", "subscribed");

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}
