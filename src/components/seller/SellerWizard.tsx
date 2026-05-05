import { useTranslation } from "react-i18next";
import { SellerTypeStep } from "./SellerTypeStep";
import { SellerPersonalStep } from "./SellerPersonalStep";
import { SellerBusinessStep } from "./SellerBusinessStep";
import { SellerDocumentsStep } from "./SellerDocumentsStep";
import { SellerBankStep } from "./SellerBankStep";
import { SellerReviewStep } from "./SellerReviewStep";
import type { Seller, SellerDocumentCategory, SellerType } from "@/types/seller";

export type WizardStep = "type" | "personal" | "business" | "documents" | "bank" | "review";

/** Steps for the wizard. Type step is always present. */
export function getWizardSteps(isBusiness: boolean): WizardStep[] {
  if (isBusiness) {
    return ["type", "business", "personal", "documents", "bank", "review"];
  }
  return ["type", "personal", "documents", "bank", "review"];
}

export function getWizardStepLabels(t: (key: string) => string): Record<WizardStep, string> {
  return {
    type: t("seller.steps.type.label"),
    personal: t("seller.steps.personal.label"),
    business: t("seller.steps.business.label"),
    documents: t("seller.steps.documents.label"),
    bank: t("seller.steps.bank.label"),
    review: t("seller.steps.review.label"),
  };
}

interface SellerWizardProps {
  seller: Seller | null;
  currentStep: WizardStep;
  onStepChange: (step: WizardStep) => void;
  onCreateSeller: (type: SellerType, document?: string) => Promise<Seller>;
  onSaveDraft: (data: Record<string, unknown>) => Promise<Seller>;
  onSubmit: () => Promise<void>;
  onUploadDocument: (category: SellerDocumentCategory, file: File, identitySubType?: "front" | "back" | "full") => Promise<void>;
  onRemoveDocument: (documentId: string) => Promise<void>;
}

export function SellerWizard({
  seller,
  currentStep,
  onStepChange,
  onCreateSeller,
  onSaveDraft,
  onSubmit,
  onUploadDocument,
  onRemoveDocument,
}: SellerWizardProps) {
  const isBusiness = seller?.type === "business";
  const steps = getWizardSteps(isBusiness);
  const currentIndex = steps.indexOf(currentStep);

  const goNext = () => {
    const next = steps[currentIndex + 1];
    if (next) onStepChange(next);
  };

  const handleTypeSelect = async (type: SellerType, document: string) => {
    if (!seller) {
      await onCreateSeller(type, document);
    } else if (seller.type !== type) {
      const updates: Record<string, unknown> = { type };
      if (type === "individual") {
        updates.taxpayer_id = document;
        updates.ein = null;
      } else {
        updates.ein = document;
        updates.taxpayer_id = null;
      }
      await onSaveDraft(updates);
    }
    // Use the type we just selected (not stale seller state) to pick the right next step
    const freshSteps = getWizardSteps(type === "business");
    const nextStep = freshSteps[freshSteps.indexOf("type") + 1];
    if (nextStep) onStepChange(nextStep);
  };

  // Type step is read-only once seller is created
  const typeIsLocked = !!seller;

  return (
    <div className="w-full max-w-[460px] mx-auto">
      {currentStep === "type" && (
        <SellerTypeStep
          value={seller?.type}
          onChange={handleTypeSelect}
          locked={typeIsLocked}
          lockedDoc={
            seller?.type === "individual"
              ? seller?.taxpayer_id ?? undefined
              : seller?.ein ?? undefined
          }
          onNext={goNext}
        />
      )}

      {currentStep === "personal" && seller && (
        <SellerPersonalStep
          seller={seller}
          onSave={onSaveDraft}
          onNext={goNext}
        />
      )}

      {currentStep === "business" && seller && (
        <SellerBusinessStep
          seller={seller}
          onSave={onSaveDraft}
          onNext={goNext}
        />
      )}

      {currentStep === "documents" && seller && (
        <SellerDocumentsStep
          seller={seller}
          onUpload={onUploadDocument}
          onSave={onSaveDraft}
          onRemoveDocument={onRemoveDocument}
          onNext={goNext}
        />
      )}

      {currentStep === "bank" && seller && (
        <SellerBankStep
          seller={seller}
          onSave={onSaveDraft}
          onNext={goNext}
        />
      )}

      {currentStep === "review" && seller && (
        <SellerReviewStep
          seller={seller}
          onSubmit={onSubmit}
          onGoToStep={onStepChange}
        />
      )}
    </div>
  );
}
