import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Language = "pt-BR" | "en" | "es";

function resolveLanguage(raw: string): Language {
  if (raw === "en") return "en";
  if (raw === "es") return "es";
  return "pt-BR";
}

/**
 * Hook para gerenciar idioma da aplicação.
 * - `language`: idioma atual
 * - `setLanguage(lang, userId?)`: troca idioma + persiste no Supabase se userId fornecido
 */
export function useLanguage() {
  const { i18n, t } = useTranslation();
  const { toast } = useToast();

  const language = resolveLanguage(i18n.language);

  const setLanguage = useCallback(
    async (next: Language, userId?: string | null) => {
      const prev = resolveLanguage(i18n.language);

      // Otimista: aplica imediatamente (i18n.changeLanguage grava no localStorage)
      await i18n.changeLanguage(next);

      if (!userId) return; // não logado — só localStorage

      // Persiste no Supabase em background (profiles + user_metadata)
      try {
        // 1. Atualiza user_metadata (usado pelo auth hook para idioma dos emails)
        const { error: metaError } = await supabase.auth.updateUser({
          data: { language: next },
        });
        if (metaError) console.warn("[language] user_metadata update failed:", metaError);

        // 2. Atualiza profiles.preferences
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("user_id", userId)
          .maybeSingle();

        const merged = {
          ...((profile?.preferences as Record<string, unknown>) ?? {}),
          language: next,
        };

        const { error } = await supabase
          .from("profiles")
          .update({ preferences: merged })
          .eq("user_id", userId);

        if (error) throw error;
      } catch (err) {
        console.error("[language] remote persist failed", err);
        // Rollback
        await i18n.changeLanguage(prev);
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("profile.preferences.saveErrorDescription"),
        });
      }
    },
    [i18n, toast, t],
  );

  return { language, setLanguage } as const;
}
