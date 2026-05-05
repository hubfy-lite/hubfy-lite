import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getPublicSiteUrl } from "@/lib/public-site-url";

interface CustomerAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  accentColor: string;
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  onSuccess: () => void;
}

export function CustomerAuthModal({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  accentColor,
  mode,
  onModeChange,
  onSuccess,
}: CustomerAuthModalProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const resetState = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setLoading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const emailRedirectTo = `${getPublicSiteUrl()}${window.location.pathname}${window.location.search}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo,
          data:
            mode === "signup"
              ? { signup_as: "customer", customer_tenant_id: tenantId }
              : undefined,
        },
      });
      if (error) {
        toast({
          variant: "destructive",
          title: t("customerAuth.error"),
          description: error.message,
        });
        return;
      }
      setStep("code");
      toast({
        variant: "success",
        title: t("customerAuth.codeSentTitle"),
        description: t("customerAuth.codeSentDescription", { email }),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("customerAuth.error"),
        description: t("customerAuth.unexpectedError"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "email",
      });
      if (error) {
        toast({
          variant: "destructive",
          title: t("customerAuth.invalidCode"),
          description: error.message,
        });
        return;
      }

      // If existing user logging in, ensure they're linked to this tenant
      if (mode === "login") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Best-effort: add customer role if not already present
          await supabase.from("user_roles").upsert(
            { user_id: user.id, role: "customer" },
            { onConflict: "user_id,role" }
          ).select();
          // Ensure customer record exists
          await supabase.from("customers").upsert(
            { tenant_id: tenantId, user_id: user.id, email: user.email || "" },
            { onConflict: "tenant_id,user_id" }
          ).select();
        }
      }

      toast({ variant: "success", title: t("customerAuth.welcomeTitle"), description: t("customerAuth.welcomeDescription", { tenantName }) });
      handleOpenChange(false);
      onSuccess();
    } catch {
      toast({
        variant: "destructive",
        title: t("customerAuth.error"),
        description: t("customerAuth.unexpectedVerifyError"),
      });
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signup" ? t("customerAuth.signup") : t("customerAuth.login");
  const subtitle =
    mode === "signup"
      ? t("customerAuth.signupSubtitle", { tenantName })
      : t("customerAuth.loginSubtitle", { tenantName });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("customerAuth.emailLabel")}</label>
              <Input
                type="email"
                placeholder={t("customerAuth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                autoFocus
              />
            </div>
            <Button
              className="w-full text-white"
              style={{ backgroundColor: accentColor }}
              disabled={loading || !email.trim()}
              onClick={handleSendCode}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("customerAuth.sending")}
                </>
              ) : (
                t("customerAuth.sendCode")
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? (
                <>
                  {t("customerAuth.alreadyHaveAccount")}{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => onModeChange("login")}
                  >
                    {t("customerAuth.login")}
                  </button>
                </>
              ) : (
                <>
                  {t("customerAuth.noAccount")}{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => onModeChange("signup")}
                  >
                    {t("customerAuth.signup")}
                  </button>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStep("email");
                setCode("");
              }}
            >
              <ArrowLeft className="size-3" />
              {t("customerAuth.back")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("customerAuth.otpInstruction")} <strong className="text-foreground">{email}</strong>
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="w-full text-white"
              style={{ backgroundColor: accentColor }}
              disabled={loading || code.length !== 6}
              onClick={handleVerifyCode}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("customerAuth.verifying")}
                </>
              ) : (
                t("customerAuth.verifyCode")
              )}
            </Button>
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={handleSendCode}
              disabled={loading}
            >
              {t("customerAuth.resendCode")}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
