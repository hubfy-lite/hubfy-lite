import { useState, useRef } from "react";
import { Plus, ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GridSkeleton } from "@/components/admin/TableSkeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";
import { ShowcaseEditModal } from "@/components/admin/ShowcaseEditModal";
import { limitNameLength } from "@/lib/name-limits";

const ADMIN_IMAGE_PLACEHOLDER = "/images/placeholder.svg";

export default function AdminShowcases() {
  const { tenant, loading: tenantLoading } = useTenant();
  const { t } = useTranslation();
  const [editId, setEditId] = useState<string | null | undefined>(undefined); // undefined=closed, null=new, string=edit

  const hasLoadedOnce = useRef(false);

  const { data: showcases, isPending, refetch } = useQuery({
    queryKey: ["showcases", tenant?.id],
    queryFn: async () => {
      if (!tenant) return [];
      const { data, error } = await supabase
        .from("showcases")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((showcase) => ({
        ...showcase,
        title: limitNameLength(showcase.title),
      }));
    },
    enabled: !!tenant,
    staleTime: 10_000,
  });

  if (!isPending) {
    hasLoadedOnce.current = true;
  }

  const loading = tenantLoading || (!!tenant && isPending && !hasLoadedOnce.current);
  const modalOpen = editId !== undefined;

  return (
    <>
      <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex h-full min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col space-y-6">
        {/* Header + CTA */}
        <div className="flex items-center justify-between">
          <h1 className="text-title">{t("showcases.title")}</h1>
          <Button onClick={() => setEditId(null)}>
            <Plus className="size-4 mr-2" />
            {t("showcases.newShowcase")}
          </Button>
        </div>

        {loading ? (
          <GridSkeleton items={6} />
        ) : !showcases?.length ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <ImageIcon className="size-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground font-medium">{t("showcases.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("showcases.emptyDescription")}
              </p>
            </div>
            <Button onClick={() => setEditId(null)}>
              <Plus className="size-4 mr-2" />
              {t("showcases.newShowcase")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {showcases.map((sc) => (
              <div
                key={sc.id}
                className={cn(
                  "group relative rounded-2xl border border-border overflow-hidden",
                  "bg-card hover:border-foreground/20 transition-all"
                )}
              >
                {/* Imagem com overlay no hover */}
                <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden relative">
                  {(sc.bg_url || sc.bg_dark_url || sc.bg_light_url || sc.hero_url) ? (
                    <img
                      src={(sc.bg_url || sc.bg_dark_url || sc.bg_light_url || sc.hero_url)!}
                      alt={sc.title}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <img
                      src={ADMIN_IMAGE_PLACEHOLDER}
                      alt=""
                      className="size-full object-cover opacity-70"
                    />
                  )}
                  {/* Máscara escura + botões no hover */}
                  <div className={cn(
                    "absolute inset-0 bg-black/50",
                    "flex items-center justify-center gap-2",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  )}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/70 text-white bg-transparent hover:bg-white/15 hover:text-white"
                      onClick={() => setEditId(sc.id)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.open(`/showcases/${sc.slug}`, "_blank", "noopener,noreferrer")}
                    >
                      {t("common.access")}
                    </Button>
                  </div>
                </div>
                {/* Texto clicável para editar */}
                <button
                  onClick={() => setEditId(sc.id)}
                  className="w-full p-4 space-y-1 text-left"
                >
                  <h3 className="font-semibold text-foreground truncate">{sc.title}</h3>
                  {sc.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{sc.description}</p>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      <ShowcaseEditModal
        showcaseId={editId === undefined ? null : editId}
        open={modalOpen}
        onOpenChange={(open) => { if (!open) setEditId(undefined); }}
        onSave={() => refetch()}
      />
    </>
  );
}
