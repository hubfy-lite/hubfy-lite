import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Package, Palette, GraduationCap, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface OnboardingStatus {
  hasProduct: boolean;
  hasCourse: boolean;
  hasDesignCustomized: boolean;
}

interface Props {
  onboarding: OnboardingStatus | undefined;
  loading: boolean;
}

const steps = [
  {
    key: "hasProduct" as const,
    titleKey: "dashboard.onboarding.createProduct",
    descKey: "dashboard.onboarding.createProductDesc",
    icon: Package,
    href: "/admin/products",
  },
  {
    key: "hasDesignCustomized" as const,
    titleKey: "dashboard.onboarding.customizeDesign",
    descKey: "dashboard.onboarding.customizeDesignDesc",
    icon: Palette,
    href: "/admin/design",
  },
  {
    key: "hasCourse" as const,
    titleKey: "dashboard.onboarding.createCourse",
    descKey: "dashboard.onboarding.createCourseDesc",
    icon: GraduationCap,
    href: "/admin/courses",
  },
];

export default function DashboardOnboarding({ onboarding, loading }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Hide section when all steps are completed
  if (onboarding && onboarding.hasProduct && onboarding.hasCourse && onboarding.hasDesignCustomized) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-section">{t("dashboard.onboarding.title")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => {
          const completed = onboarding?.[step.key] ?? false;

          return (
            <Card
              key={step.key}
              variant="bordered"
              size="sm"
              className="hover:bg-secondary/50 transition-colors cursor-pointer group"
              onClick={() => navigate(step.href)}
            >
              <CardContent className="pt-4">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-4">
                      <div
                        className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                          completed ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <step.icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">{t(step.titleKey)}</h3>
                          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <p className="text-support mt-0.5">{t(step.descKey)}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Badge variant={completed ? "success" : "secondary"}>
                        {completed ? t("dashboard.onboarding.completed") : t("dashboard.onboarding.pending")}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
