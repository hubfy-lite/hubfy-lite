import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSeller } from "@/hooks/useSeller";
import { useTenant } from "@/hooks/useTenant";
import {
  SellerWizard,
  getWizardSteps,
  getWizardStepLabels,
  type WizardStep,
} from "@/components/seller/SellerWizard";
import {
  validateBusiness,
  validatePersonal,
  validateDocuments,
  validateBank,
} from "@/components/seller/sellerValidation";
import { SellerSummary } from "@/components/seller/SellerSummary";
import { SidebarStepper, type StepperSection } from "@/components/ui/sidebar-stepper";
import { MobileStepper } from "@/components/ui/mobile-stepper";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── Wizard layout (no seller / draft / rejected) ─── */

/** URL-friendly step slugs: ?businesstype, ?businessinfo, etc. */
const STEP_SLUGS: Record<WizardStep, string> = {
  type: "businesstype",
  business: "businessinfo",
  personal: "ownerinfo",
  documents: "documents",
  bank: "bankaccount",
  review: "review",
};
const SLUG_TO_STEP: Record<string, WizardStep> = Object.fromEntries(
  Object.entries(STEP_SLUGS).map(([k, v]) => [v, k as WizardStep])
);

function SellerWizardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const {
    seller,
    isRejected,
    createSeller,
    saveDraft,
    submitSeller,
    uploadDocument,
    removeDocument,
    refetch,
  } = useSeller();
  const { tenant } = useTenant();

  // Set page title: "Ativar sua conta | TenantName | Hubfy"
  useEffect(() => {
    const segments = [t("seller.activateTitle"), tenant?.name, "Hubfy"].filter(Boolean);
    document.title = segments.join(" | ");
  }, [t, tenant?.name]);

  const isBusiness = seller?.type === "business";
  const steps = getWizardSteps(isBusiness);
  const stepLabels = getWizardStepLabels(t);

  // Resolve initial step from URL: ?businesstype, ?ownerinfo, etc.
  const urlSlug = Array.from(searchParams.keys())[0] ?? "";
  const initialStep = SLUG_TO_STEP[urlSlug] || "type";

  const [currentStep, setCurrentStep] = useState<WizardStep>(
    steps.includes(initialStep) ? initialStep : "type"
  );

  // Sync step to URL — produces clean ?businesstype (no =)
  const handleStepChange = useCallback(
    (step: WizardStep) => {
      setCurrentStep(step);
      const slug = STEP_SLUGS[step];
      const url = `${window.location.pathname}?${slug}`;
      window.history.replaceState(null, "", url);
      // Refetch seller data when entering review step to ensure freshness
      if (step === "review") refetch();
    },
    [refetch]
  );

  const [userId, setUserId] = useState<string | null>(null);

  // Get user id for language switcher persistence
  useEffect(() => {
    if (!userId) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setUserId(data.user.id);
      });
    }
  }, [userId]);

  const currentIndex = steps.indexOf(currentStep);

  // Compute which steps are actually complete (validated)
  const completedSteps = useMemo(() => {
    const completed = new Set<string>();
    if (!seller) return completed;

    // Type step is always complete once seller exists
    completed.add("type");

    if (isBusiness && validateBusiness(seller).length === 0) completed.add("business");
    if (validatePersonal(seller).length === 0) completed.add("personal");
    if (validateDocuments(seller).length === 0) completed.add("documents");
    if (validateBank(seller).length === 0) completed.add("bank");

    // Review is "complete" only when all others are
    const allOthersComplete = steps.filter(s => s !== "review").every(s => completed.has(s));
    if (allOthersComplete) completed.add("review");

    return completed;
  }, [seller, isBusiness, steps]);

  // Build sections for SidebarStepper
  const verifySteps = steps.filter((s) => s !== "review" && s !== "bank");
  const bankStep = steps.find((s) => s === "bank");
  const sections: StepperSection[] = [
    {
      id: "verify",
      label: t("seller.sections.verify"),
      steps: verifySteps.map((s) => ({ id: s, label: stepLabels[s] })),
    },
    {
      id: "bank-section",
      label: t("seller.sections.bank"),
      steps: bankStep ? [{ id: "bank", label: stepLabels.bank }] : [],
    },
    {
      id: "review",
      label: t("seller.sections.review"),
      steps: [],
    },
  ];

  const handleClose = () => {
    navigate("/admin");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header — sticky */}
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4">
        <button
          type="button"
          onClick={handleClose}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-5" />
        </button>
        <div className="h-5 w-px bg-border" />
        <span className="text-sm font-medium">{t("seller.activateTitle")}</span>

        {/* Right side: language switcher */}
        <div className="ml-auto">
          <LanguageSwitcher userId={userId} />
        </div>
      </header>

      {/* Mobile stepper */}
      <div className="px-4 pt-6 lg:hidden">
        <MobileStepper totalSteps={steps.length} currentStep={currentIndex} />
      </div>

      {/* Body */}
      <div className="flex flex-1">
        {/* Desktop sidebar stepper */}
        <aside className="hidden w-64 shrink-0 border-r px-6 pt-10 lg:block">
          <SidebarStepper
            sections={sections}
            currentStep={currentStep}
            stepsOrder={steps}
            completedSteps={completedSteps}
            onStepClick={(stepId) => {
              if (steps.includes(stepId as WizardStep)) {
                handleStepChange(stepId as WizardStep);
              }
            }}
          />
        </aside>

        {/* Form content */}
        <main className="flex-1 overflow-y-auto px-4 py-8 lg:px-10">
          {isRejected && seller?.rejection_reason && (
            <div className="mx-auto mb-6 max-w-[460px]">
              <Alert variant="destructive">
                <XCircle className="size-4" />
                <AlertDescription>
                  <strong>{t("seller.rejected.title")}</strong>
                  <p className="mt-1">{seller.rejection_reason}</p>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <SellerWizard
            seller={seller}
            currentStep={currentStep}
            onStepChange={handleStepChange}
            onCreateSeller={createSeller}
            onSaveDraft={saveDraft}
            onSubmit={submitSeller}
            onUploadDocument={uploadDocument}
            onRemoveDocument={removeDocument}
          />
        </main>
      </div>
    </div>
  );
}

/* ─── Status pages (pending / approved / disabled / deleted) ─── */

export default function AdminSeller() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    seller,
    loading,
    isApproved,
    isPending,
    requestReapproval,
  } = useSeller();

  // Redirect pending/approved to settings seller tab
  useEffect(() => {
    if (!loading && (isPending || isApproved)) {
      navigate("/admin/settings/seller", { replace: true });
    }
  }, [loading, isPending, isApproved, navigate]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </>
    );
  }

  // Pending
  if (isPending) {
    return (
      <>
        <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="size-8 text-yellow-600" />
            </div>
            <h1 className="text-title mb-2">{t("seller.pending.title")}</h1>
            <p className="text-body text-muted-foreground">{t("seller.pending.description")}</p>
          </div>
          <Card>
            <CardContent className="p-6">
              <SellerSummary seller={seller!} />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Approved
  if (isApproved) {
    const handleRequestReapproval = async () => {
      try {
        await requestReapproval();
        toast.success(t("seller.reapprovalRequested"));
      } catch (err: any) {
        toast.error(err.message || t("common.error"));
      }
    };

    return (
      <>
        <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-success-border bg-success-bg">
              <CheckCircle2 className="size-8 text-success-text" />
            </div>
            <h1 className="text-title mb-2">{t("seller.approved.title")}</h1>
            <p className="text-body text-muted-foreground">{t("seller.approved.description")}</p>
          </div>
          <Card>
            <CardContent className="p-6">
              <SellerSummary seller={seller!} />
            </CardContent>
          </Card>
          <div className="text-center">
            <Button variant="outline" onClick={handleRequestReapproval}>
              {t("seller.approved.requestChange")}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Disabled / Deleted
  if (seller && (seller.status === "disabled" || seller.status === "deleted")) {
    return (
      <>
        <div className="mx-auto max-w-xl space-y-6 px-4 py-10 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="size-8 text-muted-foreground" />
          </div>
          <h1 className="text-title mb-2">{t(`seller.${seller.status}.title`)}</h1>
          <p className="text-body text-muted-foreground">{t(`seller.${seller.status}.description`)}</p>
          <Card>
            <CardContent className="p-6">
              <SellerSummary seller={seller} />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // No seller / Draft / Rejected → full-screen wizard
  return <SellerWizardPage />;
}
