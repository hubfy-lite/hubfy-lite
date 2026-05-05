import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, ChevronRight, Sparkles, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY_PREFIX = "hubfy.onboarding.checklist.dismissed:";

export default function DashboardChecklist({ onStartTour }: { onStartTour?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, completedCount, totalCount, isLoading, isComplete } = useOnboardingChecklist();

  const dismissKey = user?.id ? `${DISMISS_KEY_PREFIX}${user.id}` : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissKey) return;
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  if (dismissed || isComplete) return null;

  const handleDismiss = () => {
    if (dismissKey) localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <Card variant="bordered" data-tour="dashboard-checklist">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-section">
              <Sparkles className="size-5 text-primary" />
              {t("onboarding.checklist.title", "Comece por aqui")}
            </CardTitle>
            <CardDescription className="text-support mt-1">
              {t("onboarding.checklist.description", "Configure o essencial para sair vendendo hoje")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onStartTour && (
              <Button variant="outline" size="sm" onClick={onStartTour}>
                {t("onboarding.checklist.retour", "Rever tour")}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleDismiss} title={t("onboarding.checklist.dismiss", "Dispensar")}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-meta whitespace-nowrap">
            {completedCount}/{totalCount}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-5 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </li>
              ))
            : items.map((item) => (
                <li
                  key={item.key}
                  className="group flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-secondary/40 -mx-6 px-6"
                  onClick={() => navigate(item.href)}
                >
                  {item.completed ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        item.completed ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {t(item.titleKey)}
                    </p>
                    {!item.completed && (
                      <p className="text-support truncate">{t(item.descKey)}</p>
                    )}
                  </div>
                  {!item.completed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(item.href);
                      }}
                    >
                      {t("onboarding.checklist.action", "Fazer agora")}
                      <ChevronRight className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
        </ul>
      </CardContent>
    </Card>
  );
}
