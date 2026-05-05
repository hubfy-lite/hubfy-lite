import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isSamePasswordAsCurrentError } from "@/lib/supabaseAuthErrors";
import { AuthLayoutAnimated } from "@/components/auth/AuthLayoutAnimated";

type Mode = "loading" | "form" | "success" | "linkError";

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Detecta erro direto no hash (link inválido/expirado enviado pelo Supabase)
    const hash = window.location.hash;
    if (hash && hash.includes("error=")) {
      setMode("linkError");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    // Aguarda o evento PASSWORD_RECOVERY do Supabase
    // O SDK processa o hash automaticamente e dispara esse evento
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        window.history.replaceState(null, "", window.location.pathname);
        setMode("form");
      }
    });

    // Se não receber o evento em 4 segundos, o link provavelmente é inválido
    timeoutRef.current = setTimeout(() => {
      setMode((current) => {
        if (current === "loading") return "linkError";
        return current;
      });
    }, 4000);

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (password.length < 6) {
      setPasswordError(t("auth.resetPassword.minLength"));
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(t("auth.resetPassword.mismatch"));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { needs_password: null },
      });

      if (error && !isSamePasswordAsCurrentError(error)) {
        setPasswordError(error.message);
        return;
      }

      setMode("success");
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 2000);
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("auth.resetPassword.unexpectedError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Loading ──
  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Link inválido ou expirado ──
  if (mode === "linkError") {
    return (
      <AuthLayoutAnimated>
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t("auth.resetPassword.linkErrorTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("auth.resetPassword.linkErrorSubtitle")}
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="size-8 text-destructive" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.resetPassword.requestNewLink")}
          </p>
          <Link to="/admin/forgot-password">
            <Button variant="outline" className="h-12">
              {t("auth.resetPassword.requestNewLinkButton")}
            </Button>
          </Link>
        </div>
      </AuthLayoutAnimated>
    );
  }

  // ── Sucesso ──
  if (mode === "success") {
    return (
      <AuthLayoutAnimated>
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t("auth.resetPassword.successTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("auth.resetPassword.successSubtitle")}
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-full bg-success/10 p-3">
            <CheckCircle className="size-8 text-success" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.resetPassword.redirecting")}
          </p>
        </div>
      </AuthLayoutAnimated>
    );
  }

  // ── Formulário de nova senha ──
  return (
    <AuthLayoutAnimated>
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {t("auth.resetPassword.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("auth.resetPassword.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field>
          <FieldLabel htmlFor="password">{t("auth.resetPassword.newPasswordLabel")}</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.resetPassword.minLengthPlaceholder")}
              className="h-12 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <Field data-invalid={!!passwordError}>
          <FieldLabel htmlFor="confirmPassword">{t("auth.resetPassword.confirmLabel")}</FieldLabel>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder={t("auth.resetPassword.confirmPlaceholder")}
              className="h-12 pr-10"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {passwordError && <FieldError>{passwordError}</FieldError>}
        </Field>

        <Button
          type="submit"
          className="w-full h-12 text-base font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("common.saving")}
            </>
          ) : (
            t("auth.resetPassword.submit")
          )}
        </Button>
      </form>
    </AuthLayoutAnimated>
  );
}
