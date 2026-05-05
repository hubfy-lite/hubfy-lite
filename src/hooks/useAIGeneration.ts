import { useMutation } from "@tanstack/react-query";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";
import type { AIProviderKey } from "@/hooks/useAIProviders";
import type { AILanguageCode } from "@/lib/ai-languages";
import { toast } from "sonner";

export type AIFeature = "course_basics";

export interface CourseBasicsResult {
  title: string;
  description: string;
}

// Result shape per feature — extend as new features are added.
export type AIGenerationResult = {
  course_basics: CourseBasicsResult;
};

interface GenerateArgs<F extends AIFeature> {
  feature: F;
  input: Record<string, unknown>;
  provider: AIProviderKey;
  language: AILanguageCode;
}

export function useAIGeneration<F extends AIFeature>() {
  const { tenant } = useTenant();

  const mutation = useMutation({
    mutationFn: async (args: GenerateArgs<F>): Promise<AIGenerationResult[F]> => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");

      const { data } = await invokeEdgeFunction<{ result: AIGenerationResult[F] }>(
        "ai-generate",
        {
          body: {
            tenant_id: tenant.id,
            feature: args.feature,
            input: args.input,
            provider: args.provider,
            language: args.language,
          },
        },
      );

      return data.result;
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  return {
    generate: mutation.mutateAsync,
    isGenerating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
