/**
 * Página de edição de integração de gateway de pagamento.
 *
 * Genérica: funciona para qualquer provider em GATEWAY_PROVIDERS.
 * Usa useGatewayIntegration (tenant_integrations) ao invés de useGateway (legado).
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

import { useGatewayIntegration } from "@/hooks/useGatewayIntegration";
import { useTenant } from "@/hooks/useTenant";
import { useGatewayLogs } from "@/hooks/useGatewayLogs";
import type { GatewayLogsFilters } from "@/hooks/useGatewayLogs";

import GatewayConnectForm from "@/components/admin/integrations/GatewayConnectForm";
import GatewaySettingsTab from "@/components/admin/integrations/GatewaySettingsTab";
import GatewayMappingTab from "@/components/admin/integrations/GatewayMappingTab";
import GatewayLogsTab from "@/components/admin/integrations/GatewayLogsTab";
import GatewaySyncTab from "@/components/admin/integrations/GatewaySyncTab";

import { PROVIDERS } from "@/lib/integration-registry";
import {
  GATEWAY_PROVIDERS,
  GATEWAY_CREDENTIALS_CONFIG,
  isGatewayProvider,
  type GatewayProvider,
} from "@/lib/gateway";

type ActiveTab = "general" | "mapping" | "sync" | "logs";

export default function AdminIntegrationEdit() {
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();

  const isValid = provider && isGatewayProvider(provider);

  useEffect(() => {
    if (!isValid) {
      navigate("/admin/integrations", { replace: true });
    }
  }, [isValid, navigate]);

  if (!isValid || !provider) return null;

  return <IntegrationPage provider={provider as GatewayProvider} />;
}

/* ── Página da integração ── */

function IntegrationPage({ provider }: { provider: GatewayProvider }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const def = PROVIDERS[provider as keyof typeof PROVIDERS];
  const meta = def
    ? { name: def.displayName, icon: def.icon ?? def.logo }
    : { name: provider, icon: "" };

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as ActiveTab) || "general";
  const setActiveTab = (tab: ActiveTab) =>
    setSearchParams({ tab }, { replace: true });
  const [logsFilters, setLogsFilters] = useState<GatewayLogsFilters>({
    status: "",
    email: "",
  });

  const {
    integration,
    isLoading,
    isConnected,
    connect,
    updateCredentials,
    disconnect,
    isConnecting,
    isUpdating,
    isDisconnecting,
  } = useGatewayIntegration(provider);

  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const logsProps = useGatewayLogs(logsFilters, {
    enabled: isConnected && activeTab === "logs",
  });

  // Verificar se outro gateway de pagamento já está ativo
  const { data: activeGateway } = useQuery({
    queryKey: ["active-payment-gateway", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from("tenant_integrations")
        .select("provider")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("provider", ["hotmart"])
        .maybeSingle();
      return data as { provider: string } | null;
    },
    enabled: !!tenantId && !isConnected,
  });
  const otherGatewayActive = activeGateway && activeGateway.provider !== provider;

  /* ── Campos de credenciais editáveis ── */
  const fields = GATEWAY_CREDENTIALS_CONFIG[provider];
  const [editValues, setEditValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = "";
    return initial;
  });

  // Reset quando integração muda
  useEffect(() => {
    const reset: Record<string, string> = {};
    for (const f of fields) reset[f.key] = "";
    setEditValues(reset);
  }, [integration?.id]);

  function handleFieldChange(key: string, value: string) {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  }

  /* Dirty: qualquer campo preenchido = tem algo pra salvar */
  const isDirty = useMemo(() => {
    return Object.values(editValues).some((v) => v.trim() !== "");
  }, [editValues]);

  /* ── Handlers ── */

  function goBack() {
    navigate("/admin/integrations");
  }

  async function handleConnect(creds: Record<string, string>) {
    try {
      await connect(creds);
    } catch {
      // toast já é mostrado pelo hook
    }
  }

  async function handleSave() {
    if (!isDirty) return;
    const creds: Record<string, string> = {};
    for (const [key, val] of Object.entries(editValues)) {
      if (val.trim()) creds[key] = val.trim();
    }
    if (Object.keys(creds).length === 0) return;
    try {
      await updateCredentials(creds);
      // Limpar campos após salvar com sucesso
      const reset: Record<string, string> = {};
      for (const f of fields) reset[f.key] = "";
      setEditValues(reset);
    } catch {
      // toast já é mostrado pelo hook
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      goBack();
    } catch {
      // toast já é mostrado pelo hook
    }
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "general", label: "Geral" },
    { id: "mapping", label: "Mapear Produtos" },
    { id: "sync", label: "Smart Sync" },
    { id: "logs", label: "Eventos" },
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col min-h-0 bg-card">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={goBack}>
              <X className="size-4" />
            </Button>
            {meta.icon && (
              <img
                src={meta.icon}
                alt={meta.name}
                className="h-5 w-5 shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="text-base font-semibold text-foreground">{meta.name}</span>
            {isConnected && (
              <Badge variant="success" className="text-xs">
                Conectado
              </Badge>
            )}
          </div>

          {isConnected ? (
            <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          ) : (
            <div />
          )}

          <div className="w-[140px]" />
        </div>

        {/* ── Conteúdo ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !isConnected ? (

            <div className="mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px]">
              {otherGatewayActive ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                  <div className="size-12 rounded-full bg-warning/10 flex items-center justify-center">
                    <AlertTriangle className="size-6 text-warning" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-lg font-semibold">Gateway ativo detectado</h3>
                    <p className="text-sm text-muted-foreground">
                      Você já tem o <span className="font-medium capitalize text-foreground">{activeGateway!.provider}</span> conectado.
                      Para ativar o {meta.name}, desconecte o gateway atual primeiro em{" "}
                      <button
                        className="text-primary underline underline-offset-2"
                        onClick={() => navigate(`/admin/integrations/${activeGateway!.provider}`)}
                      >
                        Integrações &gt; {activeGateway!.provider}
                      </button>.
                    </p>
                  </div>
                </div>
              ) : (
                <GatewayConnectForm
                  provider={provider}
                  tenantId={tenantId}
                  onConnect={handleConnect}
                  isPending={isConnecting}
                />
              )}
            </div>

          ) : activeTab === "general" && integration ? (

            <GatewaySettingsTab
              provider={provider}
              tenantId={tenantId!}
              integration={integration}
              editValues={editValues}
              onFieldChange={handleFieldChange}
              onDisconnect={handleDisconnect}
              disconnectPending={isDisconnecting}
            />

          ) : activeTab === "mapping" && integration ? (

            tenantId ? (
              <GatewayMappingTab
                provider={provider}
                integrationId={integration.id}
                tenantSlug={tenant?.slug ?? null}
              />
            ) : null

          ) : activeTab === "sync" && integration ? (

            <GatewaySyncTab
              provider={provider}
              integrationId={integration.id}
              credentialsHint={integration.credentials_hint}
            />

          ) : activeTab === "logs" ? (

            <div className="mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px]">
              <GatewayLogsTab
                {...logsProps}
                filters={logsFilters}
                onFiltersChange={setLogsFilters}
              />
            </div>

          ) : null}
        </div>

        {/* ── Rodapé fixo (credenciais) ── */}
        {isConnected && activeTab === "general" && (
          <div className="border-t border-border shrink-0 bg-card">
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <Button variant="outline" onClick={goBack}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isUpdating || !isDirty}
              >
                {isUpdating && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
