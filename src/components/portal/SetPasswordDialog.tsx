import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isSamePasswordAsCurrentError } from "@/lib/supabaseAuthErrors";
import { translateAppError } from "@/lib/app-error-utils";
import { Loader2 } from "lucide-react";

/**
 * Dialog exibido quando um customer acessa o portal pela primeira vez
 * via link de convite (invite). Detecta `type=invite` no hash da URL
 * e solicita que o usuário defina uma senha.
 */
export function SetPasswordDialog() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // O Supabase client JS detecta o hash automaticamente e cria a sessão.
    // Precisamos apenas verificar se o hash continha type=invite ou type=recovery
    // para mostrar o dialog de definir senha.
    const hash = window.location.hash;
    if (hash && (hash.includes("type=invite") || hash.includes("type=recovery"))) {
      setOpen(true);
      // Limpa o hash da URL para não ficar visível
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("portal.setPassword.minLength", "A senha deve ter pelo menos 6 caracteres."));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("portal.setPassword.passwordMismatch"));
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError && !isSamePasswordAsCurrentError(updateError)) {
        setError(updateError.message);
        return;
      }

      toast({
        variant: "success",
        title: t("portal.setPassword.success"),
      });
      setOpen(false);
    } catch (error: unknown) {
      setError(translateAppError(error, t("portal.setPassword.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("portal.setPassword.title")}</DialogTitle>
          <DialogDescription>
            {t("portal.setPassword.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">
              {t("portal.setPassword.newPassword")}
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              minLength={6}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">
              {t("portal.setPassword.confirmPassword")}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("portal.setPassword.submitting")}
              </>
            ) : (
              t("portal.setPassword.submit")
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
