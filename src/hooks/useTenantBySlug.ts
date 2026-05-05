import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicTenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  theme_mode: string | null;
  hero_image_url: string | null;
  portal_use_brand_colors: boolean;
  portal_theme_mode: string;
  portal_bg_image_url: string | null;
  portal_button_color: string | null;
  portal_button_style: string;
}

export function useTenantBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["tenant-public", slug],
    queryFn: async () => {
      if (!slug) return null;

      // Usa RPC SECURITY DEFINER que retorna apenas campos públicos
      // (bypassa RLS restrita de tenant_settings)
      const { data, error } = await supabase.rpc("get_public_tenant_by_slug", {
        p_slug: slug,
      });

      if (error) throw error;

      // RPC retorna array; pegamos o primeiro (ou null se slug não existe)
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PublicTenant) ?? null;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}
