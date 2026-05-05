import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Loader2,
  Check,
  AlertTriangle,
  Sparkles,
  Zap,
  CreditCard,
} from "lucide-react";
import {
  FullscreenModal,
  FullscreenModalContent,
  FullscreenModalTitle,
} from "@/components/ui/fullscreen-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useTenant } from "@/hooks/useTenant";


interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const { subscription, isActive, isPastDue, isCanceled, willCancel, plan, isLoading } = useSubscription();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [freeLoading, setFreeLoading] = useState(false);

  const handleUpgradePro = async () => {
    toast.error(t("upgrade.notAvailable", "Upgrade via plano ainda não disponível."));
  };

  const handleSubscribeFree = async () => {
    if (!tenant?.id) {
      toast.error(t("workspaceNotFound"));
      return;
    }
    setFreeLoading(true);
    try {
      const { data: result } = await invokeEdgeFunction<{ success: boolean }>("subscribe-free", {
        body: { tenant_id: tenant.id },
      });
      if (!result?.success) throw new Error(t("upgrade.freeError"));
      toast.success(t("upgrade.freeActivated"));
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(translateEdgeError(error));
    } finally {
      setFreeLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    toast.error(t("upgrade.notAvailable", "Gerenciamento de assinatura ainda não disponível."));
  };

  const showProOnly = isActive && plan === "Free";
  const isAlreadyPro = isActive && plan === "Pro";
  const showBothPlans = !isActive || isCanceled;

  return (
    <FullscreenModal open={open} onOpenChange={onOpenChange}>
      <FullscreenModalContent className="bg-transparent" showCloseButton={false}>
        <FullscreenModalTitle className="sr-only">
          {t("upgrade.title")}
        </FullscreenModalTitle>

        <div className="flex flex-col h-[100dvh] pt-12">
          <div className="flex-1 flex flex-col min-h-0 bg-background rounded-t-2xl border-t border-x border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">{t("upgrade.title")}</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
                <X className="size-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 p-6 overflow-y-auto">
              <div className="mx-auto w-full max-w-[600px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : isAlreadyPro ? (
                  /* Already on Pro */
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
                        <Check className="size-6 text-success" />
                      </div>
                      <h3 className="text-section">{t("upgrade.alreadyPro")}</h3>
                      <p className="text-support">
                        {t("upgrade.alreadyProDesc")}
                      </p>
                    </div>

                    {willCancel && subscription?.current_period_end && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                        <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground">
                          {t("upgrade.cancelAt", { date: new Date(subscription.current_period_end).toLocaleDateString("pt-BR") })}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        disabled={portalLoading}
                        onClick={handleManageSubscription}
                      >
                        {portalLoading && <Loader2 className="size-4 animate-spin" />}
                        {t("upgrade.manageSubscription")}
                      </Button>
                    </div>
                  </div>
                ) : isPastDue ? (
                  /* Past due */
                  <div className="space-y-6">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">
                        {t("upgrade.pastDueWarning")}
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <Button
                        disabled={portalLoading}
                        onClick={handleManageSubscription}
                      >
                        {portalLoading && <Loader2 className="size-4 animate-spin" />}
                        {t("upgrade.updatePayment")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Show plan cards */
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-section">
                        {showProOnly ? t("upgrade.unlockPotential") : t("upgrade.choosePlan")}
                      </h3>
                      <p className="text-support">
                        {showProOnly
                          ? t("upgrade.unlockDesc")
                          : t("upgrade.chooseDesc")
                        }
                      </p>
                    </div>

                    <div className={cn(
                      "grid gap-4",
                      showBothPlans ? "sm:grid-cols-2" : "max-w-sm mx-auto"
                    )}>
                      {/* Free plan card */}
                      {showBothPlans && (
                        <div className="flex flex-col p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                          <div className="mb-4 flex items-center gap-2">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                              <Zap className="size-5 text-muted-foreground" />
                            </div>
                            <div>
                              <h3 className="text-body font-semibold">Free</h3>
                              <p className="text-support">{t("upgrade.freeDesc")}</p>
                            </div>
                          </div>

                          <p className="mb-4">
                            <span className="text-2xl font-semibold text-foreground">R$ 0</span>
                            <span className="text-support">{t("upgrade.perMonth")}</span>
                          </p>

                          <ul className="mb-6 space-y-2 flex-1">
                            {(t("upgrade.freeFeatures", { returnObjects: true }) as string[]).map((f) => (
                              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Check className="size-3.5 text-success shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>

                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={freeLoading || checkoutLoading}
                            onClick={handleSubscribeFree}
                          >
                            {freeLoading ? (
                              <><Loader2 className="size-4 animate-spin" />{t("upgrade.activating")}</>
                            ) : t("upgrade.startFree")}
                          </Button>
                        </div>
                      )}

                      {/* Pro plan card */}
                      <div className={cn(
                        "relative flex flex-col p-5 rounded-xl border bg-card transition-colors",
                        "border-primary/40 ring-1 ring-primary/20"
                      )}>
                        <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                          <Sparkles className="size-3" />
                          {t("upgrade.recommended")}
                        </span>

                        <div className="mb-4 flex items-center gap-2">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                            <CreditCard className="size-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-body font-semibold">Pro</h3>
                            <p className="text-support">{t("upgrade.proDesc")}</p>
                          </div>
                        </div>

                        <p className="mb-4">
                          <span className="text-2xl font-semibold text-foreground">R$ 97</span>
                          <span className="text-support">{t("upgrade.perMonth")}</span>
                        </p>

                        <ul className="mb-6 space-y-2 flex-1">
                          {(t("upgrade.proFeatures", { returnObjects: true }) as string[]).map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Check className="size-3.5 text-success shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>

                        <Button
                          className="w-full"
                          disabled={checkoutLoading || freeLoading}
                          onClick={handleUpgradePro}
                        >
                          {checkoutLoading ? (
                            <><Loader2 className="size-4 animate-spin" />{t("upgrade.processing")}</>
                          ) : t("upgrade.subscribePro")}
                        </Button>

                        <p className="text-center text-xs text-muted-foreground mt-3">
                          {t("upgrade.couponHint")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </FullscreenModalContent>
    </FullscreenModal>
  );
}
