import { useTranslation } from "react-i18next";
import type { Seller } from "@/types/seller";
import { SellerStatusBadge } from "./SellerStatusBadge";

interface SellerSummaryProps {
  seller: Seller;
}

function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatRevenue(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US").format(value);
}

export function SellerSummary({ seller }: SellerSummaryProps) {
  const { t, i18n } = useTranslation();
  const isBusiness = seller.type === "business";
  const currencyLabel = i18n.language === "pt-BR" ? "BRL" : "USD";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-body font-medium">
            {isBusiness ? seller.business_name : `${seller.first_name ?? ""} ${seller.last_name ?? ""}`}
          </p>
          <p className="text-support text-muted-foreground">
            {t(`seller.type.${seller.type}`)}
          </p>
        </div>
        <SellerStatusBadge status={seller.status} />
      </div>

      {/* Dados pessoais / Sócio */}
      <div className="space-y-2">
        <h4 className="text-label font-medium">{isBusiness ? t("seller.ownerData") : t("seller.personalData")}</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">{t("seller.fields.name")}</span>
          <span>{seller.first_name} {seller.last_name}</span>

          <span className="text-muted-foreground">{t("seller.fields.email")}</span>
          <span>{seller.email}</span>

          <span className="text-muted-foreground">{t("seller.fields.phone")}</span>
          <span>{seller.phone_number}</span>

          <span className="text-muted-foreground">{t("seller.fields.cpf")}</span>
          <span>{seller.taxpayer_id ? formatCpf(seller.taxpayer_id) : "—"}</span>

          <span className="text-muted-foreground">{t("seller.fields.birthdate")}</span>
          <span>{seller.birthdate ?? "—"}</span>
        </div>
      </div>

      {/* Dados empresa (PJ) */}
      {isBusiness && (
        <div className="space-y-2">
          <h4 className="text-label font-medium">{t("seller.businessData")}</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t("seller.fields.businessName")}</span>
            <span>{seller.business_name}</span>

            <span className="text-muted-foreground">{t("seller.fields.cnpj")}</span>
            <span>{seller.ein ? formatCnpj(seller.ein) : "—"}</span>

            <span className="text-muted-foreground">{t("seller.fields.businessEmail")}</span>
            <span>{seller.business_email}</span>

            <span className="text-muted-foreground">{t("seller.fields.businessPhone")}</span>
            <span>{seller.business_phone}</span>

            <span className="text-muted-foreground">{t("seller.fields.openingDate")}</span>
            <span>{seller.business_opening_date ?? "—"}</span>
          </div>
        </div>
      )}

      {/* Financeiro */}
      <div className="space-y-2">
        <h4 className="text-label font-medium">{t("seller.financialData")}</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">{t("seller.fields.revenueAnnual")} ({currencyLabel})</span>
          <span>{seller.revenue ? formatRevenue(seller.revenue, i18n.language) : "—"}</span>

          <span className="text-muted-foreground">{t("seller.fields.mainActivity")}</span>
          <span>
            {seller.cnae?.main?.id
              ? `${seller.cnae.main.id} - ${seller.main_activity ?? seller.cnae.main.text}`
              : seller.main_activity ?? "—"}
          </span>
        </div>
      </div>

      {/* Documentos */}
      {seller.seller_documents && seller.seller_documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-label font-medium">{t("seller.documents")}</h4>
          <div className="space-y-1">
            {seller.seller_documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t(`seller.documentCategory.${doc.category}`)}</span>
                <span className="truncate">{doc.original_filename}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
