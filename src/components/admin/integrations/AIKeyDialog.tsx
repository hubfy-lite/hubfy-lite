import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, KeyRound, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAIIntegration, type AIProvider } from "@/hooks/useAIIntegration";
import { PROVIDERS } from "@/lib/integration-registry";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

interface AIKeyDialogProps {
  provider: AIProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIKeyDialog({ provider, open, onOpenChange }: AIKeyDialogProps) {
  const { t } = useTranslation();
  const def = PROVIDERS[provider];
  const meta = {
    name: def.displayName,
    logo: def.logo,
    placeholder: def.placeholders?.api_key ?? "",
    helpUrl: def.helpUrl ?? "",
  };

  const {
    integration,
    isConnected,
    connect,
    disconnect,
    isConnecting,
    isDisconnecting,
  } = useAIIntegration(provider);

  const [keyInput, setKeyInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const hint = integration?.credentials_hint as Record<string, string> | null;
  const maskedKey = hint?.api_key ?? "••••";

  async function handleConnect() {
    const key = keyInput.trim();
    if (!key) return;
    try {
      await connect(key);
      setKeyInput("");
      setIsEditing(false);
    } catch {
      // toast handled by hook
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      setConfirmDisconnect(false);
      onOpenChange(false);
    } catch {
      // toast handled by hook
    }
  }

  function handleClose(value: boolean) {
    if (!value) {
      setKeyInput("");
      setIsEditing(false);
      setConfirmDisconnect(false);
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <img
              src={meta.logo}
              alt={meta.name}
              className="h-6 w-6 shrink-0 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <DialogTitle className="flex items-center gap-2">
              {meta.name}
              {isConnected && (
                <Badge variant="success" className="text-xs font-normal">
                  {t("integrations.card.connected")}
                </Badge>
              )}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isConnected
              ? t("integrations.ai.manageDescription", { provider: meta.name })
              : t("integrations.ai.connectDescription", { provider: meta.name })}
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          /* ── Connect form ── */
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <Input
                {...NO_AUTOFILL_PROPS}
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={meta.placeholder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConnect();
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t("integrations.ai.keyHint")}{" "}
                <a
                  href={meta.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {meta.helpUrl.replace("https://", "")}
                </a>
              </p>
            </div>

            <Button
              onClick={handleConnect}
              disabled={isConnecting || !keyInput.trim()}
              className="w-full"
            >
              {isConnecting && <Loader2 className="size-4 animate-spin" />}
              {t("integrations.ai.connect", { provider: meta.name })}
            </Button>
          </div>
        ) : !confirmDisconnect ? (
          /* ── Connected: show hint + actions ── */
          <div className="space-y-4">
            {/* API Key hint */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <KeyRound className="size-3.5" />
                API Key
              </label>

              {!isEditing ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <code className="flex-1 text-sm text-muted-foreground">
                    {maskedKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setKeyInput("");
                      setIsEditing(true);
                    }}
                  >
                    <RefreshCw className="size-3.5" />
                    {t("integrations.ai.changeKey")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                  <Input
                    {...NO_AUTOFILL_PROPS}
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder={meta.placeholder}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConnect();
                      if (e.key === "Escape") {
                        setKeyInput("");
                        setIsEditing(false);
                      }
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setKeyInput("");
                        setIsEditing(false);
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={isConnecting || !keyInput.trim()}
                    >
                      {isConnecting && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      {t("integrations.ai.saveKey")}
                    </Button>
                  </div>
                </div>
              )}

              {integration?.last_validated_at && (
                <p className="text-xs text-muted-foreground">
                  {t("integrations.ai.lastValidated")}{" "}
                  {new Date(integration.last_validated_at).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Disconnect */}
            <div className="pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDisconnect(true)}
              >
                <Unplug className="size-3.5" />
                {t("integrations.ai.disconnect", { provider: meta.name })}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Confirm disconnect ── */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("integrations.ai.disconnectConfirm", { provider: meta.name })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDisconnect(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {t("integrations.ai.confirmDisconnect")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
