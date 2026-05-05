import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resetPassword } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import {
  AuthLayoutAnimated,
  type CharacterState,
} from "@/components/auth/AuthLayoutAnimated";

function createForgotPasswordSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("auth.validation.emailInvalid")),
  });
}

type ForgotPasswordFormData = z.infer<ReturnType<typeof createForgotPasswordSchema>>;

type ForgotPasswordAnimatedProps = {
  basePath?: string;
};

export default function ForgotPasswordAnimated({ basePath = "" }: ForgotPasswordAnimatedProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isTypingEmail, setIsTypingEmail] = useState(false);
  const { toast } = useToast();

  const loginPath = `${basePath}/login`;

  const forgotPasswordSchema = createForgotPasswordSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const characterState: CharacterState = {
    isTypingEmail,
    isTypingPassword: false,
    showPassword: false,
    hasPassword: false,
  };

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(data.email);

      if (error) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: error.message,
        });
      } else {
        setEmailSent(true);
      }
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

  // ─── Sucesso — email enviado ───
  if (emailSent) {
    return (
      <AuthLayoutAnimated>
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t("auth.forgotPassword.successTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("auth.forgotPassword.successSubtitle")}
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-full bg-success/10 p-3">
            <CheckCircle className="size-8 text-success" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.forgotPassword.successDescription")}
          </p>
          <Link to={loginPath}>
            <Button variant="outline" className="mt-2 h-12">
              <ArrowLeft className="size-4" />
              <span>{t("auth.forgotPassword.backToLogin")}</span>
            </Button>
          </Link>
        </div>
      </AuthLayoutAnimated>
    );
  }

  // ─── Formulário ───
  return (
    <AuthLayoutAnimated characterState={characterState}>
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {t("auth.forgotPassword.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("auth.forgotPassword.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">{t("auth.forgotPassword.emailLabel")}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.forgotPassword.emailPlaceholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            className="h-12"
            onFocus={() => setIsTypingEmail(true)}
            onBlur={() => setIsTypingEmail(false)}
            {...register("email")}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </Field>

        <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          <span>{isLoading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submitButton")}</span>
        </Button>
      </form>

      <div className="text-center">
        <Link
          to={loginPath}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 size-4" />
          {t("auth.forgotPassword.backToLogin")}
        </Link>
      </div>
    </AuthLayoutAnimated>
  );
}
