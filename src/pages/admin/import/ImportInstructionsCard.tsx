import { useTranslation } from "react-i18next";
import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImportInstructionsCardProps {
  importType: "customers" | "contacts";
  maxRows: number;
  onDownloadTemplate: () => void;
}

export function ImportInstructionsCard({
  importType,
  maxRows,
  onDownloadTemplate,
}: ImportInstructionsCardProps) {
  const { t } = useTranslation();
  const ns = importType === "contacts" ? "contactImport" : "customerImport";

  const requiredCols =
    importType === "customers"
      ? ["email", "name", "product_ids"]
      : ["email", "name"];

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="size-4 text-muted-foreground" />
          {t(`${ns}.formatTitle`)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>{t(`${ns}.requiredColumns`)}</strong>{" "}
            {requiredCols.map((col, i) => (
              <span key={col}>
                {i > 0 && ", "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{col}</code>
              </span>
            ))}
          </p>
          {importType === "customers" && (
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              {t("customerImport.productIdsHint")}
            </p>
          )}
          <p>
            <strong>{t(`${ns}.optionalColumns`)}</strong> {t(`${ns}.optionalColumnsValue`)}
          </p>
          <p>
            <strong>{t(`${ns}.limit`)}</strong> {t(`${ns}.limitValue`, { max: maxRows })}{" "}
            {t(`${ns}.noEmailSent`)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadTemplate}
          className="gap-2"
        >
          <Download className="size-3.5" />
          {t(`${ns}.downloadModel`)}
        </Button>
      </CardContent>
    </Card>
  );
}
