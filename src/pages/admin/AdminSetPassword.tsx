import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayoutAnimated } from "@/components/auth/AuthLayoutAnimated";

export default function AdminSetPassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Only users who signed up without a password should access this page
  if (!user?.user_metadata?.needs_password) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (password.length < 8) {
      setPasswordError(t("auth.setPassword.minLength"));
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordError(t("auth.setPassword.mustHaveLettersAndNumbers"));
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(t("auth.setPassword.mismatch"));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { needs_password: null },
      });

      if (error) {
        setPasswordError(error.message);
        return;
      }

      toast({
        variant: "success",
        title: t("auth.setPassword.successTitle"),
        description: t("auth.setPassword.successDescription"),
      });

      navigate("/admin", { replace: true });
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.unexpectedError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayoutAnimated>
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {t("auth.setPassword.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("auth.setPassword.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field>
          <FieldLabel htmlFor="password">{t("auth.setPassword.passwordLabel")}</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.setPassword.minLengthPlaceholder")}
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
          <FieldLabel htmlFor="confirmPassword">{t("auth.setPassword.confirmLabel")}</FieldLabel>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder={t("auth.setPassword.confirmPlaceholder")}
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
              {t("auth.setPassword.submitting")}
            </>
          ) : (
            t("auth.setPassword.submit")
          )}
        </Button>
      </form>
    </AuthLayoutAnimated>
  );
}
