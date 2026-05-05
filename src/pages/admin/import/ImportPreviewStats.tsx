import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

interface ImportPreviewStatsProps {
  importType: "customers" | "contacts";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  withProducts: number;
}

export function ImportPreviewStats({
  importType,
  totalRows,
  validRows,
  invalidRows,
  withProducts,
}: ImportPreviewStatsProps) {
  const { t } = useTranslation();
  const ns = importType === "contacts" ? "contactImport" : "customerImport";

  return (
    <div className={`grid gap-3 ${importType === "customers" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
      <Card variant="bordered">
        <CardContent className="pt-4 pb-4">
          <p className="text-2xl font-semibold">{totalRows}</p>
          <p className="text-xs text-muted-foreground">
            {t(`${ns}.summary.total`)}
          </p>
        </CardContent>
      </Card>
      <Card variant="bordered">
        <CardContent className="pt-4 pb-4">
          <p className="text-2xl font-semibold text-emerald-600">{validRows}</p>
          <p className="text-xs text-muted-foreground">{t(`${ns}.summary.valid`)}</p>
        </CardContent>
      </Card>
      <Card variant="bordered">
        <CardContent className="pt-4 pb-4">
          <p className="text-2xl font-semibold text-red-600">{invalidRows}</p>
          <p className="text-xs text-muted-foreground">
            {t(`${ns}.summary.invalid`)}
          </p>
        </CardContent>
      </Card>
      {importType === "customers" && (
        <Card variant="bordered">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-semibold">{withProducts}</p>
            <p className="text-xs text-muted-foreground">
              {t("customerImport.summary.withProducts")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
