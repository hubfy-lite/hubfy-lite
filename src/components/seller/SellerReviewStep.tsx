import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useBrazilianBanks } from "@/hooks/useBrazilianBanks";
import type { Seller } from "@/types/seller";
import type { WizardStep } from "./SellerWizard";
import {
  validateBusiness,
  validatePersonal,
  validateDocuments,
  validateBank,
} from "./sellerValidation";

interface SellerReviewStepProps {
  seller: Seller;
  onSubmit: () => Promise<void>;
  onGoToStep: (step: WizardStep) => void;
}

/* ────────────────────────────────────────────
   Format helpers
   ──────────────────────────────────────────── */

function formatCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

/* ────────────────────────────────────────────
   Section Card component
   ──────────────────────────────────────────── */

function SectionCard({
  title,
  incomplete,
  onEdit,
  children,
  editLabel,
  incompleteLabel,
}: {
  title: string;
  incomplete: boolean;
  onEdit: () => void;
  children: React.ReactNode;
  editLabel: string;
  incompleteLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          {incomplete && (
            <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              {incompleteLabel}
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            {editLabel}
          </Button>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        {children}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   Summary row helper
   ──────────────────────────────────────────── */

function SummaryRow({ label, value, error }: { label: string; value: string | null | undefined; error?: boolean }) {
  return (
    <>
      <span className={error ? "text-destructive font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={error ? "text-destructive" : !value ? "text-muted-foreground" : ""}>{value || "—"}</span>
    </>
  );
}

/* ────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────── */

export function SellerReviewStep({ seller, onSubmit, onGoToStep }: SellerReviewStepProps) {
  const { t } = useTranslation();
  const { data: banks } = useBrazilianBanks(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const isBusiness = seller.type === "business";

  const businessErrors = useMemo(() => (isBusiness ? validateBusiness(seller) : []), [seller, isBusiness]);
  const personalErrors = useMemo(() => validatePersonal(seller), [seller]);
  const documentsErrors = useMemo(() => validateDocuments(seller), [seller]);
  const bankErrors = useMemo(() => validateBank(seller), [seller]);

  const allComplete =
    businessErrors.length === 0 &&
    personalErrors.length === 0 &&
    documentsErrors.length === 0 &&
    bankErrors.length === 0;

  const bankLabel = useMemo(() => {
    if (!seller.bank_code || !banks) return "";
    const bank = banks.find((b) => String(b.code) === seller.bank_code);
    return bank ? `${String(bank.code).padStart(3, "0")} - ${bank.name}` : seller.bank_code;
  }, [seller.bank_code, banks]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit();
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const editLabel = t("seller.steps.review.edit");
  const incompleteLabel = t("seller.steps.review.incomplete");

  const docs = seller.seller_documents ?? [];

  // Filter docs relevant to the selected combo only
  const comboCategories: Record<string, string[]> = {
    selfie_cnh_full: ["selfie", "cnh_full"],
    selfie_cnh_front_back: ["selfie", "cnh_front", "cnh_back"],
    selfie_rg_front_back: ["selfie", "rg_front", "rg_back"],
  };
  const relevantCategories = seller.identity_doc_type
    ? comboCategories[seller.identity_doc_type] ?? []
    : [];
  const comboDocs = docs.filter((d) => relevantCategories.includes(d.category));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-normal text-foreground md:text-xl">
          {t("seller.steps.review.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("seller.steps.review.description")}
        </p>
      </div>

      {/* ── Section 0: Account type (read-only, no edit) ── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          {t("seller.steps.type.label")}
        </h3>
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <SummaryRow
              label={t("seller.fields.country")}
              value="🇧🇷 Brasil"
            />
            <SummaryRow
              label={t("seller.fields.businessType")}
              value={isBusiness ? t("seller.type.business") : t("seller.type.individual")}
            />
            <SummaryRow
              label={isBusiness ? t("seller.fields.cnpj") : t("seller.fields.cpf")}
              value={
                isBusiness
                  ? seller.ein ? formatCnpj(seller.ein) : null
                  : seller.taxpayer_id ? formatCpf(seller.taxpayer_id) : null
              }
            />
          </div>
        </div>
      </div>

      {/* ── Section 1: Business (PJ only) ── */}
      {isBusiness && (
        <SectionCard
          title={t("seller.steps.business.label")}
          incomplete={businessErrors.length > 0}
          onEdit={() => onGoToStep("business")}
          editLabel={editLabel}
          incompleteLabel={incompleteLabel}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <SummaryRow label={t("seller.fields.businessName")} value={seller.business_name} error={businessErrors.includes("businessName")} />
            <SummaryRow label={t("seller.fields.cnpj")} value={seller.ein ? formatCnpj(seller.ein) : null} error={businessErrors.includes("cnpj")} />
            <SummaryRow label={t("seller.fields.businessEmail")} value={seller.business_email} error={businessErrors.includes("businessEmail")} />
            <SummaryRow label={t("seller.fields.businessPhone")} value={seller.business_phone} error={businessErrors.includes("businessPhone")} />
            <SummaryRow label={t("seller.fields.openingDate")} value={seller.business_opening_date} error={businessErrors.includes("openingDate")} />
            <SummaryRow label={t("seller.fields.businessDescription")} value={seller.business_description} />
            <SummaryRow
              label={t("seller.fields.revenueAnnual")}
              value={seller.revenue ? `R$ ${(seller.revenue / 100).toLocaleString("pt-BR")}` : null}
              error={businessErrors.includes("revenue")}
            />
            <SummaryRow
              label={t("seller.fields.mainActivity")}
              value={
                seller.cnae?.main?.id
                  ? `${seller.cnae.main.id} - ${seller.main_activity ?? seller.cnae.main.text}`
                  : seller.main_activity ?? null
              }
              error={businessErrors.includes("mainActivity")}
            />
            {seller.business_address_line1 ? (
              <SummaryRow
                label={t("seller.sections.businessAddress")}
                value={`${seller.business_address_line1}, ${seller.business_address_line2 ?? ""} — ${seller.business_address_city}/${seller.business_address_state}`}
              />
            ) : (businessErrors.includes("addressLine1") || businessErrors.includes("city") || businessErrors.includes("state") || businessErrors.includes("postalCode")) ? (
              <SummaryRow
                label={t("seller.sections.businessAddress")}
                value={null}
                error
              />
            ) : null}
          </div>
        </SectionCard>
      )}

      {/* ── Section 2: Personal / Owner ── */}
      <SectionCard
        title={isBusiness ? t("seller.steps.personal.label") : t("seller.steps.personal.label")}
        incomplete={personalErrors.length > 0}
        onEdit={() => onGoToStep("personal")}
        editLabel={editLabel}
        incompleteLabel={incompleteLabel}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <SummaryRow label={t("seller.fields.firstName")} value={seller.first_name} error={personalErrors.includes("firstName")} />
          <SummaryRow label={t("seller.fields.lastName")} value={seller.last_name} error={personalErrors.includes("lastName")} />
          <SummaryRow label={t("seller.fields.email")} value={seller.email} error={personalErrors.includes("email")} />
          <SummaryRow label={t("seller.fields.phone")} value={seller.phone_number} error={personalErrors.includes("phone")} />
          <SummaryRow label={t("seller.fields.birthdate")} value={seller.birthdate} error={personalErrors.includes("birthdate")} />
          <SummaryRow label={t("seller.fields.cpf")} value={seller.taxpayer_id ? formatCpf(seller.taxpayer_id) : null} error={personalErrors.includes("cpf")} />
          {seller.address_line1 ? (
            <SummaryRow
              label={isBusiness ? t("seller.sections.ownerAddress") : t("seller.sections.personalAddress")}
              value={`${seller.address_line1}, ${seller.address_line2 ?? ""} — ${seller.address_city}/${seller.address_state}`}
            />
          ) : (personalErrors.includes("addressLine1") || personalErrors.includes("city") || personalErrors.includes("state") || personalErrors.includes("postalCode")) ? (
            <SummaryRow
              label={isBusiness ? t("seller.sections.ownerAddress") : t("seller.sections.personalAddress")}
              value={null}
              error
            />
          ) : null}
        </div>
      </SectionCard>

      {/* ── Section 3: Documents ── */}
      <SectionCard
        title={t("seller.steps.documents.label")}
        incomplete={documentsErrors.length > 0}
        onEdit={() => onGoToStep("documents")}
        editLabel={editLabel}
        incompleteLabel={incompleteLabel}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <SummaryRow
            label={t("seller.steps.documents.comboTitle")}
            value={
              seller.identity_doc_type
                ? (t(`seller.steps.documents.combo.${seller.identity_doc_type}`, { defaultValue: "" }) || seller.identity_doc_type)
                : null
            }
            error={documentsErrors.includes("docType")}
          />
          {comboDocs.map((doc) => (
            <SummaryRow
              key={doc.id}
              label={t(`seller.documentCategory.${doc.category}`)}
              value={doc.original_filename}
            />
          ))}
          {/* Show missing docs as errors */}
          {documentsErrors
            .filter((e) => e !== "docType")
            .map((cat) => (
              <SummaryRow
                key={cat}
                label={t(`seller.documentCategory.${cat}`)}
                value={null}
                error
              />
            ))}
        </div>
      </SectionCard>

      {/* ── Section 4: Bank ── */}
      <SectionCard
        title={t("seller.steps.bank.label")}
        incomplete={bankErrors.length > 0}
        onEdit={() => onGoToStep("bank")}
        editLabel={editLabel}
        incompleteLabel={incompleteLabel}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <SummaryRow label={t("seller.fields.bank")} value={bankLabel} error={bankErrors.includes("bank")} />
          <SummaryRow
            label={t("seller.fields.bankAccountType")}
            value={
              seller.bank_account_type === "savings"
                ? t("seller.fields.savingsAccount")
                : t("seller.fields.checkingAccount")
            }
          />
          <SummaryRow label={t("seller.fields.bankAgency")} value={seller.bank_agency} error={bankErrors.includes("bankAgency")} />
          <SummaryRow label={t("seller.fields.bankAccount")} value={seller.bank_account} error={bankErrors.includes("bankAccount")} />
        </div>
      </SectionCard>

      {/* Terms + Submit */}
      <div className="space-y-4 pt-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={termsAgreed}
            onCheckedChange={(checked) => setTermsAgreed(checked === true)}
          />
          <label
            htmlFor="terms"
            className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
          >
            {t("seller.steps.review.terms")}
          </label>
        </div>
        <Button
          className="w-full"
          onClick={() => setConfirmOpen(true)}
          disabled={submitting || !allComplete || !termsAgreed}
        >
          {submitting ? t("seller.submitting") : t("seller.submitForApproval")}
        </Button>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("seller.steps.review.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("seller.steps.review.confirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                await handleSubmit();
              }}
              disabled={submitting}
            >
              {submitting ? t("seller.submitting") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
