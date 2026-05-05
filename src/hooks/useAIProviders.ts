import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { PROVIDERS } from "@/lib/integration-registry";

/**
 * Options offered to the user in the AI generation dialog.
 *
 * Always includes "hubfy" (our managed default, powered by OpenAI under the hood).
 * Optionally includes providers the tenant has connected with status = "active".
 *
 * MVP scope: only OpenAI-compatible providers are callable. Anthropic is
 * deliberately excluded from the list even when connected — the edge function
 * does not yet support it, and exposing it would surface an error path.
 */

export type AIProviderKey = "hubfy" | "openai";

export interface AIProviderOption {
  key: AIProviderKey;
  label: string;
  logo: string | null;
  isDefault: boolean;
}

export function useAIProviders() {
  const { tenant } = useTenant();

  const query = useQuery({
    queryKey: ["ai-providers", tenant?.id],
    queryFn: async (): Promise<AIProviderOption[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("provider, status")
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .in("provider", ["openai"]);

      if (error) throw error;

      const hasOpenAI = !!data?.some((row) => row.provider === "openai");

      const options: AIProviderOption[] = [
        {
          key: "hubfy",
          label: "Hubfy AI",
          logo: null,
          isDefault: !hasOpenAI,
        },
      ];

      if (hasOpenAI) {
        options.push({
          key: "openai",
          label: PROVIDERS.openai.displayName,
          logo: PROVIDERS.openai.logo,
          isDefault: true,
        });
      }

      return options;
    },
    enabled: !!tenant?.id,
  });

  const options = query.data ?? [];
  const defaultOption = options.find((opt) => opt.isDefault) ?? options[0] ?? null;

  return {
    options,
    defaultOption,
    isLoading: query.isLoading,
    hasMultipleOptions: options.length > 1,
  };
}
