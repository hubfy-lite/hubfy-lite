import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildGumletEmbedUrl } from "@/lib/video-settings";

interface UseHostingVideoTokenOptions {
  lessonId: string | undefined;
  hostingAssetId: string | null;
  videoProtectionEnabled: boolean;
  videoSettings: unknown;
  fallbackColor: string | null | undefined;
  /** Whether the tenant plan allows captions (Pro/Business). */
  captionsEnabled?: boolean;
}

interface UseHostingVideoTokenResult {
  embedUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

// Em dev, usa URL relativa (vai pelo proxy Vite → sem CORS).
// Em produção, usa URL absoluta do Supabase.
const FUNCTION_URL = import.meta.env.DEV
  ? "/functions/v1/hosting-video-token"
  : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hosting-video-token`;

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Retorna a URL embed do player de vídeo para uma aula.
 *
 * Se o tenant tem `video_protection_enabled`:
 *   → Chama a edge function `hosting-video-token` para obter a URL assinada
 *
 * Caso contrário:
 *   → Builda a URL localmente com os query params de configuração do player
 *
 * O token tem validade de 4h, então cacheamos por 30min
 * para evitar chamadas desnecessárias (ficamos bem dentro da janela).
 */
export function useHostingVideoToken({
  lessonId,
  hostingAssetId,
  videoProtectionEnabled,
  videoSettings,
  fallbackColor,
  captionsEnabled,
}: UseHostingVideoTokenOptions): UseHostingVideoTokenResult {
  // Query da edge function (só roda quando proteção está ativa)
  const signedQuery = useQuery({
    queryKey: ["hosting-video-token", lessonId],
    queryFn: async () => {
      // Pega o token JWT do usuário logado
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token ?? "";

      // Usa fetch direto com URL relativa em dev (proxy Vite → sem CORS)
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ lesson_id: lessonId }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody?.error ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as { embed_url: string; signed: boolean } | null;
      if (!result?.embed_url) {
        throw new Error("Edge function não retornou embed_url");
      }

      return result.embed_url;
    },
    enabled: !!lessonId && videoProtectionEnabled && !!hostingAssetId,
    // Token lasts 4h — refresh cache every 30 min to stay safe
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  // Se proteção está ativa: usar URL assinada da edge function
  if (videoProtectionEnabled) {
    return {
      embedUrl: signedQuery.data ?? null,
      isLoading: signedQuery.isLoading,
      error: signedQuery.error as Error | null,
    };
  }

  // Sem proteção: buildar URL localmente
  if (!hostingAssetId) {
    return { embedUrl: null, isLoading: false, error: null };
  }

  const embedUrl = buildGumletEmbedUrl(hostingAssetId, videoSettings, {
    fallbackColor,
    captionsEnabled,
  });

  return { embedUrl, isLoading: false, error: null };
}
