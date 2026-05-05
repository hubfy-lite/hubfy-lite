/**
 * Formulário genérico de conexão de gateway.
 *
 * Renderiza campos dinamicamente a partir de GATEWAY_CREDENTIALS_CONFIG.
 * Substitui HotmartConnectForm (que era hardcoded para Hotmart).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface GatewayConnectFormProps {
  provider: GatewayProvider;
  tenantId: string | null;
  onConnect: (creds: Record<string, string>) => void;
  isPending: boolean;
}

/* ─── Componente ─── */

export default function GatewayConnectForm({
  provider,
  tenantId,
  onConnect,
  isPending,
}: GatewayConnectFormProps) {
  const { t } = useTranslation();
  const fields = GATEWAY_CREDENTIALS_CONFIG[provider];
  const webhookUrl = tenantId ? buildWebhookUrl(provider, tenantId) : "";

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = "";
    return initial;
  });

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const canSubmit = requiredFields.every((f) => values[f.key]?.trim());

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const creds: Record<string, string> = {};
    for (const [key, val] of Object.entries(values)) {
      if (val.trim()) creds[key] = val.trim();
    }
    onConnect(creds);
  }

  function renderField(field: CredentialField) {
    const InputComponent = field.type === "textarea" ? Textarea : Input;
    const extraProps =
      field.type === "textarea"
        ? { rows: 4, className: "text-sm font-normal resize-none" }
        : { type: field.type === "password" ? "password" : "text", className: "text-sm" };

    return (
      <Field key={field.key} orientation="split">
        <FieldContent>
          <FieldLabel>{field.label}</FieldLabel>
          {field.helpText && (
            <FieldDescription>{field.helpText}</FieldDescription>
          )}
        </FieldContent>
        <FieldControl className="max-w-[600px]">
          <InputComponent
            {...NO_AUTOFILL_PROPS}
            value={values[field.key] ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              handleChange(field.key, e.target.value)
            }
            placeholder={field.placeholder}
            {...extraProps}
          />
        </FieldControl>
      </Field>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">

      {/* Card: Webhook URL */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
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

          {/* Campos obrigatórios junto com webhook */}
          {requiredFields.map((f) => (
            <div key={f.key}>
              <div className="border-t border-border mb-5" />
              {renderField(f)}
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
          <CardContent className="flex flex-col gap-5">
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

      <Button
        type="submit"
        disabled={isPending || !canSubmit}
        className="self-start"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("integrations.gateway.connectButton")}
      </Button>
    </form>
  );
}
