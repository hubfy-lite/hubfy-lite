import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { useTenantBySlug } from "@/hooks/useTenantBySlug";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { contrastColor } from "@/lib/format";
import { joinTitleSegments } from "@/lib/page-title";
import { DEFAULT_PORTAL_BG } from "@/components/admin/design/PhotoGalleryModal";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";

const BUTTON_RADIUS: Record<string, string> = {
  rounded: "8px",
  rectangular: "2px",
  pill: "9999px",
};

type AuthStep = "email" | "sent";

export default function CustomerAuthPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { data: tenant, isLoading: tenantLoading, error } = useTenantBySlug(slug);
  const { toast } = useToast();

  const [step, setStep] = useState<AuthStep>("email");
  const [sentEmail, setSentEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const tenantName = tenant?.name || "";
  usePageTitle(tenantName ? joinTitleSegments(t("portal.meta.login", "Login"), tenantName) : null);

  // Detectar link expirado/inválido via hash do Supabase
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.replace("#", ""));
    const errorDesc = params.get("error_description") || "";
    if (errorDesc.toLowerCase().includes("expired") || errorDesc.toLowerCase().includes("invalid")) {
      toast({
        variant: "destructive",
        title: t("portal.auth.linkExpiredTitle"),
        description: t("portal.auth.linkExpiredDesc"),
      });
      // Limpar hash para não mostrar de novo
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Portal customization
  const portalTheme = tenant?.portal_theme_mode === "light" ? "light" : "dark";
  const isDark = portalTheme === "dark";
  const bgImage = tenant?.portal_bg_image_url || tenant?.hero_image_url || DEFAULT_PORTAL_BG;
  const useBrand = tenant?.portal_use_brand_colors ?? true;
  const brandColor = tenant?.primary_color || "#6366f1";
  const buttonColor = useBrand ? brandColor : (tenant?.portal_button_color || brandColor);
  const buttonFg = contrastColor(buttonColor);
  const buttonRadius = BUTTON_RADIUS[tenant?.portal_button_style || "rounded"] || BUTTON_RADIUS.rounded;

  const themeColors = useMemo(() => ({
    bg: isDark ? "#0A0A0A" : "#FFFFFF",
    text: isDark ? "#F5F5F5" : "#1A1A1A",
    textSecondary: isDark ? "#A0A0A0" : "#666666",
    inputBg: isDark ? "#1A1A1A" : "#F5F5F5",
    inputBorder: isDark ? "#2A2A2A" : "#E5E5E5",
  }), [isDark]);

  /* ── Schema ── */
  const emailSchema = z.object({
    email: z.string().email(t("auth.validation.emailInvalid")),
  });

  type EmailData = z.infer<typeof emailSchema>;

  const emailForm = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const requestMagicLink = async (data: EmailData) => {
    if (!tenant || !slug) return;
    setLoading(true);
    try {
      await invokeEdgeFunction("customer-auth-start", {
        body: {
          tenant_slug: slug,
          email: data.email,
          redirect_origin: window.location.origin,
        },
      });

      // Sempre transicionar para "sent" — edge function retorna success mesmo sem customer
      setSentEmail(data.email);
      setStep("sent");
    } catch (err) {
      if ((err as { status?: number }).status === 429) {
        toast({
          variant: "destructive",
          title: t("portal.auth.rateLimitTitle"),
          description: t("portal.auth.rateLimitDesc"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: translateEdgeError(err),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    requestMagicLink({ email: sentEmail });
  };

  /* ── Loading / Error states ── */
  if (tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-semibold text-foreground">{t("tenant.notFound")}</h1>
        <p className="text-muted-foreground">{t("tenant.notFoundHint")}</p>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="min-h-screen" style={{ background: themeColors.bg }}>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* Image — left */}
        <div className="relative hidden lg:block">
          {bgImage ? (
            <img src={bgImage} alt={tenantName} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            />
          )}
        </div>

        {/* Form side */}
        <div className="relative flex items-center justify-center px-6 py-12">
          <div className={`absolute top-4 right-4 ${isDark ? "dark" : ""}`}>
            <LanguageSwitcher />
          </div>
          <div className="w-full max-w-md space-y-6">
            {/* Tenant branding */}
            <div className="flex items-center justify-center gap-3 mb-8">
              {tenant.icon_url && (
                <img
                  src={tenant.icon_url}
                  alt={tenantName}
                  className="size-10 rounded-full object-cover"
                />
              )}
              <span className="text-lg font-semibold" style={{ color: themeColors.text }}>
                {tenantName}
              </span>
            </div>

            {step === "email" ? (
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-semibold" style={{ color: themeColors.text }}>
                    {t("portal.auth.title")}
                  </h1>
                  <p style={{ color: themeColors.textSecondary }}>
                    {t("portal.auth.subtitle", { tenantName })}
                  </p>
                </div>

                <form onSubmit={emailForm.handleSubmit(requestMagicLink)} className="space-y-4">
                  <Field data-invalid={!!emailForm.formState.errors.email}>
                    <FieldLabel htmlFor="email" style={{ color: themeColors.textSecondary }}>
                      {t("common.email")}
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("tenant.customerAuth.emailPlaceholder")}
                      autoComplete="email"
                      aria-invalid={!!emailForm.formState.errors.email}
                      style={{
                        background: themeColors.inputBg,
                        borderColor: themeColors.inputBorder,
                        color: themeColors.text,
                      }}
                      {...emailForm.register("email")}
                    />
                    <FieldError>{emailForm.formState.errors.email?.message}</FieldError>
                  </Field>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                    style={{
                      background: buttonColor,
                      color: buttonFg,
                      borderRadius: buttonRadius,
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("portal.auth.sending")}
                      </>
                    ) : (
                      t("portal.auth.sendLink")
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="space-y-6 text-center">
                <div
                  className="mx-auto flex size-16 items-center justify-center rounded-full"
                  style={{ background: isDark ? "#1A1A1A" : "#F5F5F5" }}
                >
                  <Mail className="size-7" style={{ color: buttonColor }} />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold" style={{ color: themeColors.text }}>
                    {t("portal.auth.checkInbox")}
                  </h1>
                  <p style={{ color: themeColors.textSecondary }}>
                    {t("portal.auth.sentTo", { email: sentEmail })}
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                    style={{
                      background: buttonColor,
                      color: buttonFg,
                      borderRadius: buttonRadius,
                    }}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      t("portal.auth.resend")
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("email"); setSentEmail(""); }}
                    className="w-full h-11 text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
                    style={{ color: themeColors.textSecondary }}
                  >
                    <ArrowLeft className="size-4" />
                    {t("portal.auth.useOtherEmail")}
                  </button>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: themeColors.textSecondary, opacity: 0.7 }}>
                  {t("portal.auth.linkExpiryHint")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
