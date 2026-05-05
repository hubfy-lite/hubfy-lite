import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import { translateAppError } from "@/lib/app-error-utils";
import { supabase } from "@/integrations/supabase/client";
import { isSamePasswordAsCurrentError } from "@/lib/supabaseAuthErrors";
import { AuthLayout } from "@/components/auth/AuthLayout";

type AcceptInviteFormData = z.infer<ReturnType<typeof createSchema>>;

function createSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(2, t("auth.validation.nameMin2")),
      password: z.string().min(6, t("auth.validation.passwordMin6")),
      confirmPassword: z.string().min(6, t("auth.validation.passwordMin6")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.validation.passwordsMismatch"),
      path: ["confirmPassword"],
    });
}

export default function AcceptInvite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [ready, setReady] = useState(false);

  const heroImage = "/images/bg_auth_001.webp";
  const schema = createSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  // Detect invite flow from URL hash (present right after clicking invite link)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=invite")) {
      setIsInviteFlow(true);
      // Clean hash from URL
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // Once auth finishes loading, decide whether to show form or redirect
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in and no invite hash → go to login
      if (!isInviteFlow) {
        navigate("/admin/login", { replace: true });
      }
      return;
    }

    // User is logged in — check if this is a team member invite
    const signupAs = user.user_metadata?.signup_as;
    if (isInviteFlow || signupAs === "team_member") {
      setIsInviteFlow(true);
      setReady(true);
    } else {
      // Not an invite flow → go to admin
      navigate("/admin", { replace: true });
    }
  }, [authLoading, user, isInviteFlow, navigate]);

  const onSubmit = async (data: AcceptInviteFormData) => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Set password + update name in auth metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
        data: { name: data.name },
      });

      if (updateError && !isSamePasswordAsCurrentError(updateError)) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: updateError.message,
        });
        return;
      }

      // 2. Upsert profile name
      await supabase
        .from("profiles")
        .upsert({ user_id: user.id, name: data.name }, { onConflict: "user_id" });

      // 3. Activate pending membership
      await supabase
        .from("tenant_users")
        .update({ status: "active" })
        .eq("user_id", user.id)
        .eq("status", "pending");

      toast({
        variant: "success",
        title: t("auth.acceptInvite.successTitle"),
        description: t("auth.acceptInvite.successDescription"),
      });

      navigate("/admin", { replace: true });
    } catch (error: unknown) {
      console.error("AcceptInvite error:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: translateAppError(error, t("common.unexpectedError")),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (authLoading || (!ready && isInviteFlow)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not ready and not invite flow, we're redirecting (useEffect handles it)
  if (!ready) return null;

  return (
    <AuthLayout heroImage={heroImage}>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("auth.acceptInvite.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("auth.acceptInvite.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">{t("auth.acceptInvite.nameLabel")}</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder={t("auth.acceptInvite.namePlaceholder")}
            autoComplete="name"
            autoFocus
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError>{errors.name?.message}</FieldError>
        </Field>

        {/* Email (locked) */}
        <Field>
          <FieldLabel htmlFor="email">{t("auth.acceptInvite.emailLabel")}</FieldLabel>
          <Input
            id="email"
            type="email"
            value={user?.email ?? ""}
            variant="readOnly"
            readOnly
          />
        </Field>

        {/* Password */}
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t("auth.acceptInvite.passwordLabel")}</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
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

        {/* Confirm Password */}
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">
            {t("auth.acceptInvite.confirmPasswordLabel")}
          </FieldLabel>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? (
                <EyeOff className="size-4 text-muted-foreground" />
              ) : (
                <Eye className="size-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </Field>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("auth.acceptInvite.submitting")}
            </>
          ) : (
            t("auth.acceptInvite.submitButton")
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
