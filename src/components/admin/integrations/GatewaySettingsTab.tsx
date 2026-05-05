/**
 * Aba de configurações genérica para gateways conectados.
 *
 * Renderiza campos editáveis a partir de GATEWAY_CREDENTIALS_CONFIG + credentials_hint.
 * Substitui HotmartSettingsTab (que era hardcoded para Hotmart).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";

import {
  buildWebhookUrl,
  GATEWAY_CREDENTIALS_CONFIG,
  type GatewayProvider,
  type CredentialField,
} from "@/lib/gateway";
import type { GatewayIntegration } from "@/hooks/useGatewayIntegration";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

/* ─── Campo de URL do webhook com copy ─── */

function WebhookUrlField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={url}
        variant="readOnly"
        readOnly
        className="flex-1 font-normal text-sm"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={copy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

/* ─── Props ─── */

interface GatewaySettingsTabProps {
  provider: GatewayProvider;
  tenantId: string;
  integration: GatewayIntegration;
  editValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onDisconnect: () => void;
  disconnectPending: boolean;
}

/* ─── Componente ─── */

export default function GatewaySettingsTab({
  provider,
  tenantId,
  integration,
  editValues,
  onFieldChange,
  onDisconnect,
  disconnectPending,
}: GatewaySettingsTabProps) {
  const { t } = useTranslation();
  const fields = GATEWAY_CREDENTIALS_CONFIG[provider];
  const webhookUrl = buildWebhookUrl(provider, tenantId);

  // Estado do modal de confirmação de desconexão
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // credentials_hint guarda valor completo para exibição
  const hint = (integration.credentials_hint ?? {}) as Record<string, string>;

  // Controle de visibilidade por campo
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  function toggleVisibility(key: string) {
    setVisibleFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function maskValue(value: string) {
    if (value.length <= 4) return "••••";
    return "•".repeat(Math.min(value.length, 32));
  }

  function renderField(field: CredentialField) {
    const isEditing = (editValues[field.key] ?? "").length > 0;
    const hintValue = hint[field.key] ?? "";
    const isVisible = visibleFields[field.key] ?? false;

    if (field.type === "textarea") {
      return (
        <Field key={field.key} orientation="split">
          <FieldContent>
            <FieldLabel>{field.label}</FieldLabel>
            {field.helpText && (
              <FieldDescription>{field.helpText}</FieldDescription>
            )}
          </FieldContent>
          <FieldControl className="max-w-[600px]">
            <Textarea
              {...NO_AUTOFILL_PROPS}
              value={editValues[field.key] ?? ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                onFieldChange(field.key, e.target.value)
              }
              placeholder={hintValue ? (isVisible ? hintValue : maskValue(hintValue)) : field.placeholder}
              rows={4}
              className="text-sm font-normal resize-none"
            />
          </FieldControl>
        </Field>
      );
    }

    return (
      <Field key={field.key} orientation="split">
        <FieldContent>
          <FieldLabel>{field.label}</FieldLabel>
          {field.helpText && (
            <FieldDescription>{field.helpText}</FieldDescription>
          )}
        </FieldContent>
        <FieldControl className="max-w-[600px]">
          <div className="flex items-center gap-2">
            <Input
              {...NO_AUTOFILL_PROPS}
              value={editValues[field.key] ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onFieldChange(field.key, e.target.value)
              }
              placeholder={
                hintValue
                  ? isVisible ? hintValue : maskValue(hintValue)
                  : field.placeholder
              }
              type="text"
              className="text-sm flex-1"
            />
            {hintValue && !isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => toggleVisibility(field.key)}
              >
                {isVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </FieldControl>
      </Field>
    );
  }

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);

  return (
    <div className="mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px] flex flex-col gap-6">

      {/* Card: Webhook */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field orientation="split">
            <FieldContent>
              <FieldLabel>{t("integrations.gateway.webhookLabel")}</FieldLabel>
              <FieldDescription>
                {t("integrations.gateway.webhookDescription")}
              </FieldDescription>
            </FieldContent>
            <FieldControl className="max-w-[600px]">
              <WebhookUrlField url={webhookUrl} />
            </FieldControl>
          </Field>

          {requiredFields.map((f) => (
            <div key={f.key}>
              <div className="border-t border-border" />
              <div className="pt-6">{renderField(f)}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Card: Credenciais opcionais (se houver) */}
      {optionalFields.length > 0 && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>
              {t("integrations.gateway.apiCardTitle", { provider: provider.charAt(0).toUpperCase() + provider.slice(1) })}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("integrations.gateway.apiCardDescription", { provider: provider.charAt(0).toUpperCase() + provider.slice(1) })}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {provider === "hotmart" && (
              <div className="rounded-md bg-muted/50 border p-4 space-y-2">
                <p className="text-sm font-medium">{t("integrations.gateway.guideTitle")}</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-4">
                  <li>
                    {t("integrations.gateway.guideStep1Prefix")}{" "}
                    <a
                      href="https://app-vlc.hotmart.com/tools/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {t("integrations.gateway.guideStep1Link")}
                    </a>
                  </li>
                  <li dangerouslySetInnerHTML={{ __html: t("integrations.gateway.guideStep2") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("integrations.gateway.guideStep3") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("integrations.gateway.guideStep4") }} />
                </ol>
              </div>
            )}
            {optionalFields.map((f) => renderField(f))}
          </CardContent>
        </Card>
      )}

      {/* Card: Zona de perigo */}
      <Card variant="bordered" className="border-destructive/30">
        <CardContent className="p-6">
          <Field orientation="split">
            <FieldContent>
              <FieldLabel className="text-destructive">
                {t("integrations.gateway.disconnectLabel")}
              </FieldLabel>
              <FieldDescription>
                {t("integrations.gateway.disconnectDescription")}
              </FieldDescription>
            </FieldContent>
            <FieldControl className="flex items-center">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDisconnectOpen(true)}
                disabled={disconnectPending}
              >
                Desconectar
              </Button>
            </FieldControl>
          </Field>
        </CardContent>
      </Card>

      {/* Modal de confirmação de desconexão */}
      <Dialog open={disconnectOpen} onOpenChange={(open) => {
        setDisconnectOpen(open);
        if (!open) setConfirmText("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Desconectar {provider}
            </DialogTitle>
            <DialogDescription className="text-left space-y-2 pt-2">
              <span className="block">Ao desconectar, as seguintes consequências serão imediatas:</span>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>Webhooks deixarão de funcionar</li>
                <li>O acesso dos alunos não será mais atualizado automaticamente</li>
                <li>Reembolsos e cancelamentos não serão processados</li>
              </ul>
              <span className="block pt-2">
                Digite <strong className="text-foreground">{provider}</strong> para confirmar:
              </span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={provider}
            autoComplete="off"
            className="text-sm"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDisconnectOpen(false);
                setConfirmText("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText.toLowerCase() !== provider.toLowerCase() || disconnectPending}
              onClick={() => {
                setDisconnectOpen(false);
                setConfirmText("");
                onDisconnect();
              }}
            >
              {disconnectPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Confirmar desconexão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
