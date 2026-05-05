import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { useGatewayIntegration } from "@/hooks/useGatewayIntegration";
import { useVimeoIntegration } from "@/hooks/useVimeoIntegration";
import { useAIIntegration, type AIProvider } from "@/hooks/useAIIntegration";
import { useSimpleIntegration } from "@/hooks/useSimpleIntegration";
import { AIKeyDialog } from "@/components/admin/integrations/AIKeyDialog";

/* ─── Definição dos provedores (via registry centralizado) ─── */

import {
  type ProviderKey,
  type ProviderDefinition,
  getProvidersByCategory,
} from "@/lib/integration-registry";

const SECTIONS = getProvidersByCategory();

/* ─── Card de integração ─── */

function IntegrationCard({
  provider,
  isConnected,
  onConfigure,
}: {
  provider: ProviderDefinition;
  isConnected: boolean;
  onConfigure: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card
      variant="bordered"
      className="flex flex-col overflow-hidden transition-all min-w-[75vw] snap-start sm:min-w-0"
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center">
            <Avatar className="h-10 w-10 rounded-lg ring-1 ring-border/60">
              <AvatarImage
                src={provider.logo}
                alt={provider.displayName}
                className="rounded-lg object-cover"
              />
              <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                {provider.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            pill={false}
            className="shrink-0"
            onClick={onConfigure}
            aria-label={t("integrations.card.configure")}
          >
            <Settings className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-semibold text-sm leading-tight">{provider.displayName}</p>
          <p className="h-10 text-xs leading-5 text-muted-foreground line-clamp-2">
            {t(provider.descriptionKey)}
          </p>

          {isConnected ? (
            <Badge variant="success" className="mt-2 w-fit text-xs">
              {t("integrations.card.connected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="mt-2 w-fit text-xs">
              {t("integrationsPage.notConnected")}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Página ─── */

export default function AdminIntegrations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConnected: hotmartConnected } = useGatewayIntegration("hotmart");
  const { isConnected: vimeoConnected } = useVimeoIntegration();
  const { isConnected: openaiConnected } = useAIIntegration("openai");
  const { isConnected: anthropicConnected } = useAIIntegration("anthropic");
  const { isConnected: pandavideoConnected } = useSimpleIntegration("pandavideo", {
    connectFnName: "pandavideo-connect",
    disconnectFnName: "pandavideo-disconnect",
  });
  const { isConnected: wistiaConnected } = useSimpleIntegration("wistia", {
    connectFnName: "wistia-connect",
    disconnectFnName: "wistia-disconnect",
  });
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const [aiDialogProvider, setAiDialogProvider] = useState<AIProvider | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const allTitleKeys = SECTIONS.map((s) => s.titleKey);

  function toggleFilter(titleKey: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(titleKey)) next.delete(titleKey);
      else next.add(titleKey);
      return next;
    });
  }

  // Nenhum filtro ativo = mostra tudo
  const visibleSections =
    activeFilters.size === 0
      ? SECTIONS
      : SECTIONS.filter((s) => activeFilters.has(s.titleKey));

  function getIsConnected(key: ProviderKey): boolean {
    if (key === "hotmart") return hotmartConnected;
    if (key === "vimeo") return vimeoConnected;
    if (key === "openai") return openaiConnected;
    if (key === "anthropic") return anthropicConnected;
    if (key === "pandavideo") return pandavideoConnected;
    if (key === "wistia") return wistiaConnected;
    return false;
  }

  const AI_PROVIDERS: ProviderKey[] = ["openai", "anthropic"];
  const DIALOG_PROVIDERS: Record<string, () => void> = {};

  /** Conectados primeiro, depois alfabético pelo displayName */
  function sortProviders(providers: ProviderDefinition[]): ProviderDefinition[] {
    return [...providers].sort((a, b) => {
      const aConn = getIsConnected(a.key) ? 0 : 1;
      const bConn = getIsConnected(b.key) ? 0 : 1;
      if (aConn !== bConn) return aConn - bConn;
      return a.displayName.localeCompare(b.displayName);
    });
  }

  function handleCardClick(provider: ProviderDefinition) {
    if (!provider.available) {
      setUnavailableOpen(true);
      return;
    }
    // AI providers open a dialog instead of navigating
    if (AI_PROVIDERS.includes(provider.key)) {
      setAiDialogProvider(provider.key as AIProvider);
      return;
    }
    // Simple dialog providers
    if (provider.key in DIALOG_PROVIDERS) {
      DIALOG_PROVIDERS[provider.key]();
      return;
    }
    navigate(`/admin/integrations/${provider.key}`);
  }

  return (
    <>
      <div className="p-6 lg:p-10">
        <div className="space-y-6 w-full max-w-[1200px] 3xl:max-w-[1600px] lg:min-w-[800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-title">{t("integrations.title")}</h1>
        </div>

        {/* Filtros por categoria */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 sm:flex-wrap sm:overflow-visible">
          {allTitleKeys.map((titleKey) => (
            <Toggle
              key={titleKey}
              variant="outline"
              size="sm"
              pressed={activeFilters.has(titleKey)}
              onPressedChange={() => toggleFilter(titleKey)}
              className="shrink-0 rounded-full px-3 text-xs data-[state=on]:bg-secondary data-[state=on]:border-secondary"
            >
              {t(titleKey)}
            </Toggle>
          ))}
        </div>

        {/* Seções de integrações */}
        {visibleSections.map((section, idx) => (
          <div key={section.titleKey}>
            {idx > 0 && <Separator className="mb-8" />}
            <div className="space-y-3">
              <h2 className="text-section">{t(section.titleKey)}</h2>
              <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
                {sortProviders(section.providers).map((provider) => (
                  <IntegrationCard
                    key={provider.key}
                    provider={provider}
                    isConnected={getIsConnected(provider.key)}
                    onConfigure={() => handleCardClick(provider)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Dialog — AI provider API key */}
      {aiDialogProvider && (
        <AIKeyDialog
          provider={aiDialogProvider}
          open={!!aiDialogProvider}
          onOpenChange={(open) => {
            if (!open) setAiDialogProvider(null);
          }}
        />
      )}

      {/* Dialog — integração não disponível */}
      <Dialog open={unavailableOpen} onOpenChange={setUnavailableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aviso</DialogTitle>
            <DialogDescription>
              Integração não disponível na sua região. Contate o suporte para
              mais informações.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUnavailableOpen(false)}>
              Ok, entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
