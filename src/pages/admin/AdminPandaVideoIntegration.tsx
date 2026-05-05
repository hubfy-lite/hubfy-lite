import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, Loader2, ExternalLink, Unplug, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSimpleIntegration } from "@/hooks/useSimpleIntegration";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

export default function AdminPandaVideoIntegration() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tokenInput, setTokenInput] = useState("");

  const {
    integration,
    isLoading,
    isConnected,
    connect,
    disconnect,
    isConnecting,
    isDisconnecting,
  } = useSimpleIntegration("pandavideo", {
    connectFnName: "pandavideo-connect",
    disconnectFnName: "pandavideo-disconnect",
    successMessage: t("integrations.pandavideo.connected"),
    disconnectSuccessMessage: t("integrations.pandavideo.disconnected"),
  });

  function goBack() {
    navigate("/admin/integrations");
  }

  async function handleConnect() {
    const key = tokenInput.trim();
    if (!key) return;
    try {
      await connect({ api_key: key });
      setTokenInput("");
    } catch {
      // toast handled by hook
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      goBack();
    } catch {
      // toast handled by hook
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col min-h-0 bg-card">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={goBack}>
              <X className="size-4" />
            </Button>
            <span className="text-base font-semibold text-foreground">Panda Video</span>
            {isConnected && (
              <Badge variant="success" className="text-xs">
                {t("integrations.card.connected")}
              </Badge>
            )}
            {integration && integration.status === "error" && (
              <Badge variant="destructive" className="text-xs">
                {t("integrations.card.error", "Erro")}
              </Badge>
            )}
          </div>

          {isConnected ? (
            <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
              <button
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  "bg-background text-foreground shadow-sm",
                )}
              >
                {t("integrations.pandavideo.tabGeneral")}
              </button>
            </nav>
          ) : (
            <div />
          )}

          <div className="w-[140px]" />
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !isConnected && !integration ? (
            /* ── Connection form ── */
            <div className="mx-auto w-full max-w-lg space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{t("integrations.pandavideo.connectTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("integrations.pandavideo.connectDescription")}
                </p>
              </div>

              {/* Step-by-step guide */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="size-4 text-muted-foreground shrink-0" />
                  {t("integrations.pandavideo.guideTitle")}
                </div>
                <ol className="text-sm text-muted-foreground space-y-2 pl-1">
                  <li className="flex gap-2">
                    <span className="text-foreground font-medium shrink-0">1.</span>
                    <span>
                      {t("integrations.pandavideo.guideStep1")}{" "}
                      <a
                        href="https://dashboard.pandavideo.com.br"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        dashboard.pandavideo.com.br
                        <ExternalLink className="size-3" />
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-foreground font-medium shrink-0">2.</span>
                    <span>{t("integrations.pandavideo.guideStep2")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-foreground font-medium shrink-0">3.</span>
                    <span>{t("integrations.pandavideo.guideStep3")}</span>
                  </li>
                </ol>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">{t("integrations.pandavideo.tokenLabel")}</label>
                <Input
                  {...NO_AUTOFILL_PROPS}
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={t("integrations.pandavideo.tokenPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConnect();
                  }}
                />
              </div>

              <Button
                onClick={handleConnect}
                disabled={isConnecting || !tokenInput.trim()}
                className="w-full"
              >
                {isConnecting && <Loader2 className="size-4 animate-spin" />}
                {t("integrations.pandavideo.connect")}
              </Button>
            </div>
          ) : (
            /* ── Connected (or error) state ── */
            <div className="mx-auto w-full max-w-lg space-y-6">
              {/* Error banner */}
              {(integration?.status === "error" || integration?.last_error) && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
                  <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">
                      {t("integrations.pandavideo.errorTitle", "Erro na integração")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {integration?.last_error || t("integrations.pandavideo.errorGeneric", "Houve um problema com a conexão Panda Video.")}
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-3"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting && <Loader2 className="size-4 animate-spin" />}
                      {t("integrations.pandavideo.reconnect", "Desconectar e reconectar")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/30">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center ring-1 ring-border/60">
                  <img
                    src="/brand/integrations/pandavideo.webp"
                    alt="Panda Video"
                    className="h-7 w-7 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Panda Video</p>
                  {integration?.last_validated_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("integrations.pandavideo.lastValidated")}{" "}
                      {new Date(integration.last_validated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <h3 className="text-sm font-semibold text-destructive">{t("integrations.pandavideo.disconnectTitle")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("integrations.pandavideo.disconnectDescription")}
                </p>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting && <Loader2 className="size-4 animate-spin" />}
                  <Unplug className="size-4" />
                  {t("integrations.pandavideo.disconnect")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
