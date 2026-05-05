import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailLog {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_id: string | null;
  user_id: string | null;
  recipient_email: string;
  subject: string;
  email_type: string;
  status: string;
  resend_message_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useOrderEmailLogs(orderId: string | undefined) {
  return useQuery<EmailLog[]>({
    queryKey: ["order-email-logs", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmailLog[];
    },
    enabled: !!orderId,
  });
}
