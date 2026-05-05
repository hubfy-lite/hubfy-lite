import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft, CheckCircle, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useTenantBySlug } from "@/hooks/useTenantBySlug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import { contrastColor } from "@/lib/format";
import { isSamePasswordAsCurrentError } from "@/lib/supabaseAuthErrors";
import { translateAppError } from "@/lib/app-error-utils";
import { buildPublicUrl } from "@/lib/public-site-url";
import { DEFAULT_PORTAL_BG } from "@/components/admin/design/PhotoGalleryModal";

const BUTTON_RADIUS: Record<string, string> = {
  rounded: "8px",
  rectangular: "2px",
  pill: "9999px",
};

type PageMode = "form" | "emailSent" | "resetPassword" | "linkError";

export default function CustomerForgotPasswordPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading: tenantLoading, error } = useTenantBySlug(slug);
  const { toast } = useToast();

  const [mode, setMode] = useState<PageMode>("form");
  const [loading, setLoading] = useState(false);

  // Reset password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const tenantName = tenant?.name || "";

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

  /* ── Detectar hash de recovery ou erro na URL ── */
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    if (hash.includes("type=recovery")) {
      setMode("resetPassword");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (hash.includes("error=")) {
      setMode("linkError");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  /* ── Schema ── */
  const schema = z.object({
    email: z.string().email(t("auth.validation.emailInvalid")),
  });

  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: buildPublicUrl(`/${slug}/forgot-password`),
      });

      if (error) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: error.message,
        });
        return;
      }

      setMode("emailSent");
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.unexpectedError"),
      });
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (password.length < 6) {
      setPasswordError(t("portal.setPassword.minLength", "A senha deve ter pelo menos 6 caracteres."));
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(t("portal.setPassword.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError && !isSamePasswordAsCurrentError(updateError)) {
        setPasswordError(updateError.message);
        return;
      }

      toast({
        variant: "success",
        title: t("portal.setPassword.success"),
      });

      // Sign out so user can log in fresh with new password
      await supabase.auth.signOut();
      navigate(`/${slug}/login`, { replace: true });
    } catch (err: unknown) {
      setPasswordError(translateAppError(err, t("common.unexpectedError")));
    } finally {
      setLoading(false);
    }
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
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md space-y-6">
            {/* Tenant branding */}
            <div className="flex items-center justify-center gap-3 mb-2">
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

            {mode === "emailSent" && (
              /* ── Email enviado ── */
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle className="size-12 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-semibold" style={{ color: themeColors.text }}>
                  {t("auth.forgotPassword.successTitle")}
                </h1>
                <p style={{ color: themeColors.textSecondary }}>
                  {t("auth.forgotPassword.successDescription")}
                </p>
                <Link
                  to={`/${slug}/login`}
                  className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 border hover:opacity-80 transition-opacity"
                  style={{
                    borderColor: themeColors.inputBorder,
                    color: themeColors.text,
                    borderRadius: buttonRadius,
                  }}
                >
                  <ArrowLeft className="size-4" />
                  {t("auth.forgotPassword.backToLogin")}
                </Link>
              </div>
            )}

            {mode === "linkError" && (
              /* ── Link expirado/inválido ── */
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <AlertCircle className="size-12 text-destructive" />
                </div>
                <h1 className="text-2xl font-semibold" style={{ color: themeColors.text }}>
                  {t("tenant.customerAuth.linkExpiredTitle")}
                </h1>
                <p style={{ color: themeColors.textSecondary }}>
                  {t("tenant.customerAuth.linkExpiredDescription")}
                </p>
                <button
                  onClick={() => setMode("form")}
                  className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
                  style={{
                    background: buttonColor,
                    color: buttonFg,
                    borderRadius: buttonRadius,
                  }}
                >
                  {t("auth.forgotPassword.submitButton")}
                </button>
                <Link
                  to={`/${slug}/login`}
                  className="inline-flex items-center gap-1.5 text-sm hover:opacity-80"
                  style={{ color: themeColors.textSecondary }}
                >
                  <ArrowLeft className="size-3.5" />
                  {t("auth.forgotPassword.backToLogin")}
                </Link>
              </div>
            )}

            {mode === "resetPassword" && (
              /* ── Formulário de nova senha ── */
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-semibold" style={{ color: themeColors.text }}>
                    {t("tenant.customerAuth.resetPasswordTitle")}
                  </h1>
                  <p style={{ color: themeColors.textSecondary }}>
                    {t("tenant.customerAuth.resetPasswordSubtitle", { tenantName })}
                  </p>
                </div>

                <form onSubmit={onResetPassword} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="new-password"
                      className="text-sm font-medium"
                      style={{ color: themeColors.textSecondary }}
                    >
                      {t("portal.setPassword.newPassword")}
                    </label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoFocus
                        minLength={6}
                        required
                        style={{
                          background: themeColors.inputBg,
                          borderColor: themeColors.inputBorder,
                          color: themeColors.text,
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" style={{ color: themeColors.textSecondary }} />
                        ) : (
                          <Eye className="size-4" style={{ color: themeColors.textSecondary }} />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="confirm-password"
                      className="text-sm font-medium"
                      style={{ color: themeColors.textSecondary }}
                    >
                      {t("portal.setPassword.confirmPassword")}
                    </label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        required
                        style={{
                          background: themeColors.inputBg,
                          borderColor: themeColors.inputBorder,
                          color: themeColors.text,
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" style={{ color: themeColors.textSecondary }} />
                        ) : (
                          <Eye className="size-4" style={{ color: themeColors.textSecondary }} />
                        )}
                      </Button>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}

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
                        {t("portal.setPassword.submitting")}
                      </>
                    ) : (
                      t("portal.setPassword.submit")
                    )}
                  </button>
                </form>
              </>
            )}

            {mode === "form" && (
              /* ── Formulário de email ── */
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-semibold" style={{ color: themeColors.text }}>
                    {t("auth.forgotPassword.title")}
                  </h1>
                  <p style={{ color: themeColors.textSecondary }}>
                    {t("tenant.customerAuth.forgotPasswordSubtitle", { tenantName })}
                  </p>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <Field data-invalid={!!form.formState.errors.email}>
                    <FieldLabel htmlFor="email" style={{ color: themeColors.textSecondary }}>
                      {t("common.email")}
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("tenant.customerAuth.emailPlaceholder")}
                      autoComplete="email"
                      aria-invalid={!!form.formState.errors.email}
                      style={{
                        background: themeColors.inputBg,
                        borderColor: themeColors.inputBorder,
                        color: themeColors.text,
                      }}
                      {...form.register("email")}
                    />
                    <FieldError>{form.formState.errors.email?.message}</FieldError>
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
                        {t("auth.forgotPassword.submitting")}
                      </>
                    ) : (
                      t("auth.forgotPassword.submitButton")
                    )}
                  </button>
                </form>

                <div className="flex justify-center">
                  <Link
                    to={`/${slug}/login`}
                    className="inline-flex items-center gap-1.5 text-sm hover:opacity-80"
                    style={{ color: themeColors.textSecondary }}
                  >
                    <ArrowLeft className="size-3.5" />
                    {t("auth.forgotPassword.backToLogin")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
