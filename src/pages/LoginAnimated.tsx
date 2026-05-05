import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { signIn, signInWithGoogle } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildPublicUrl } from "@/lib/public-site-url";
import {
  AuthLayoutAnimated,
  type CharacterState,
} from "@/components/auth/AuthLayoutAnimated";

type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;

function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("auth.validation.emailInvalid")),
    password: z.string().min(6, t("auth.validation.passwordMin6")),
  });
}

type LoginAnimatedProps = {
  basePath?: string;
};

export default function LoginAnimated({ basePath = "" }: LoginAnimatedProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [isTypingEmail, setIsTypingEmail] = useState(false);
  const [isTypingPassword, setIsTypingPassword] = useState(false);
  const [showNoPasswordHint, setShowNoPasswordHint] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const debug = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug("[login]", ...args);
  };

  const isCreatorLogin = basePath === "/admin";
  const signupPath = `${basePath}/signup`;
  const forgotPasswordPath = `${basePath}/forgot-password`;

  const rawFrom =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/admin";
  const from = ["/admin/login", "/admin/signup", "/admin/forgot-password"].includes(rawFrom)
    ? "/admin"
    : rawFrom;

  const loginSchema = createLoginSchema(t);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const passwordValue = watch("password");

  // Estado dos personagens — reagem ao formulário
  const characterState: CharacterState = {
    isTypingEmail,
    isTypingPassword,
    showPassword,
    hasPassword: passwordValue.length > 0,
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    debug("submit:start", { email: data.email, basePath });
    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        debug("signIn:error", { message: error.message });

        if (error.message === "Email not confirmed") {
          setUnconfirmedEmail(data.email);
          return;
        }

        const isInvalidCreds = error.message === "Invalid login credentials";
        if (isInvalidCreds) {
          setShowNoPasswordHint(true);
        }

        toast({
          variant: "destructive",
          title: t("auth.login.errorTitle"),
          description: isInvalidCreds
            ? t("auth.login.invalidCredentials")
            : error.message,
        });
        return;
      }
      debug("signIn:success");

      toast({
        variant: "success",
        title: t("auth.login.successTitle"),
        description: t("auth.login.successDescription"),
      });

      debug("navigate", { to: from });
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Login submit error:", error);
      debug("submit:exception", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.unexpectedError"),
      });
    } finally {
      setIsLoading(false);
      debug("submit:end");
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unconfirmedEmail,
        options: { emailRedirectTo: buildPublicUrl("/admin") },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: t("auth.emailConfirmation.resendError"),
          description: error.message,
        });
      } else {
        toast({
          variant: "success",
          title: t("auth.emailConfirmation.resendSuccess"),
          description: t("auth.emailConfirmation.resendSuccessDescription"),
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("auth.emailConfirmation.resendFailed"),
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayoutAnimated characterState={characterState}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {isCreatorLogin ? t("auth.login.creatorTitle") : t("auth.login.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isCreatorLogin ? t("auth.login.creatorSubtitle") : t("auth.login.subtitle")}
        </p>
      </div>

      {/* Email não confirmado */}
      {unconfirmedEmail && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="size-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t("auth.emailConfirmation.confirmTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("auth.emailConfirmation.confirmDescription", { email: unconfirmedEmail }).replace(/<\/?strong>/g, "")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isResending}
            onClick={handleResendConfirmation}
          >
            {isResending && <Loader2 className="size-4 animate-spin" />}
            <span>{isResending ? t("auth.emailConfirmation.resending") : t("auth.emailConfirmation.resendConfirmation")}</span>
          </Button>
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">{t("auth.login.emailLabel")}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.login.emailPlaceholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            className="h-12"
            onFocus={() => setIsTypingEmail(true)}
            onBlur={() => setIsTypingEmail(false)}
            {...register("email")}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t("auth.login.passwordLabel")}</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              className="h-12 pr-10"
              onFocus={() => setIsTypingPassword(true)}
              onBlur={() => setIsTypingPassword(false)}
              {...register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="size-4 text-muted-foreground" />
              ) : (
                <Eye className="size-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <FieldError>{errors.password?.message}</FieldError>
        </Field>

        <div className="flex flex-col items-end gap-1">
          <Link
            to={forgotPasswordPath}
            className="text-sm text-primary hover:underline font-medium"
          >
            {t("auth.login.forgotPassword")}
          </Link>
          {showNoPasswordHint && (
            <p className="text-xs text-muted-foreground">
              {t("auth.login.noPasswordHint")}{" "}
              <Link to={forgotPasswordPath} className="text-primary hover:underline">
                {t("auth.login.resetPasswordLink")}
              </Link>
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          <span>{isLoading ? t("auth.login.submitting") : t("auth.login.submitButton")}</span>
        </Button>
      </form>

      {/* Divisor */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("auth.login.orDivider")}
          </span>
        </div>
      </div>

      {/* Google */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 text-base font-medium"
        disabled={isGoogleLoading}
        onClick={async () => {
          setIsGoogleLoading(true);
          const { error } = await signInWithGoogle();
          if (error) {
            toast({
              variant: "destructive",
              title: t("auth.login.errorTitle"),
              description: error.message,
            });
            setIsGoogleLoading(false);
          }
        }}
      >
        {isGoogleLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <svg className="size-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        )}
        <span>{t("auth.login.googleButton")}</span>
      </Button>

      {/* Link de cadastro */}
      <div className="text-center text-sm text-muted-foreground">
        {t("auth.login.noAccount")}{" "}
        <Link to={signupPath} className="text-foreground font-medium hover:underline">
          {t("auth.login.createAccount")}
        </Link>
      </div>
    </AuthLayoutAnimated>
  );
}
