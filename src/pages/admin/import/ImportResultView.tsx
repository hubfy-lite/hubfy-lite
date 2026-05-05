import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportResult, ImportRowResult } from "@/hooks/useCustomerImport";

interface ImportResultViewProps {
  importType: "customers" | "contacts";
  result: ImportResult;
  previewRejectedRows: ImportRowResult[];
  onReset: () => void;
  backUrl?: string;
}

export function ImportResultView({
  importType,
  result,
  previewRejectedRows,
  onReset,
  backUrl,
}: ImportResultViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ns = importType === "contacts" ? "contactImport" : "customerImport";

  const totalErrorCount = result.error_count + previewRejectedRows.length;
  const hasErrors = totalErrorCount > 0;
  const errorRows = [
    ...previewRejectedRows,
    ...result.rows.filter((r) => r.status === "error"),
  ];
  const warningRows = result.rows.filter(
    (r) => r.warnings.length > 0 && r.status !== "error",
  );
  const skippedRows = result.rows.filter((r) => r.status === "skipped");
  const ordersSkippedCount = result.rows.reduce(
    (acc, r) => acc + r.orders_skipped.length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card variant="bordered" className={hasErrors ? "border-amber-500/30" : "border-emerald-500/30"}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {t(`${ns}.result.title`)}
              </p>
              <div className="flex flex-wrap gap-3 mt-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  {t(`${ns}.result.created`, { count: result.created_count })}
                </Badge>
                {result.updated_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    {t(`${ns}.result.updated`, { count: result.updated_count })}
                  </Badge>
                )}
                {result.skipped_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                    <Info className="size-3" />
                    {t(`${ns}.result.alreadyExisted`, { count: result.skipped_count })}
                  </Badge>
                )}
                {totalErrorCount > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-destructive">
                    <AlertCircle className="size-3" />
                    {t(`${ns}.result.notProcessed`, { count: totalErrorCount })}
                  </Badge>
                )}
                {importType === "customers" && result.orders_created_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    {t("customerImport.result.accessGranted", { count: result.orders_created_count })}
                  </Badge>
                )}
                {importType === "customers" && ordersSkippedCount > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                    <Info className="size-3" />
                    {t("customerImport.result.accessExisted", { count: ordersSkippedCount })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skipped (already existed) */}
      {skippedRows.length > 0 && (
        <Card variant="bordered" className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t(`${ns}.result.skippedTitle`, { count: skippedRows.length })}
            </CardTitle>
            <CardDescription className="text-xs">
              {t(`${ns}.result.skippedDesc`)}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">{t(`${ns}.result.line`)}</TableHead>
                    <TableHead>{t(`${ns}.result.email`)}</TableHead>
                    <TableHead>{t(`${ns}.result.status`)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skippedRows.slice(0, 50).map((row) => (
                    <TableRow key={row.line}>
                      <TableCell className="text-xs">{row.line}</TableCell>
                      <TableCell className="text-xs">{row.email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {importType === "customers" && row.orders_skipped.length > 0
                          ? t("customerImport.result.hadAccess", { products: row.orders_skipped.join(", ") })
                          : t(`${ns}.result.alreadyRegistered`)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error rows */}
      {errorRows.length > 0 && (
        <Card variant="bordered" className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">
              {t(`${ns}.result.errorTitle`, { count: errorRows.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">{t(`${ns}.result.line`)}</TableHead>
                    <TableHead>{t(`${ns}.result.email`)}</TableHead>
                    <TableHead>{t(`${ns}.result.error`)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorRows.slice(0, 50).map((row) => (
                    <TableRow key={row.line}>
                      <TableCell className="text-xs">{row.line}</TableCell>
                      <TableCell className="text-xs">{row.email || "—"}</TableCell>
                      <TableCell>
                        {row.errors.map((e, i) => (
                          <p key={i} className="text-xs text-destructive">{e}</p>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning rows */}
      {warningRows.length > 0 && (
        <Card variant="bordered" className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-600">
              {t(`${ns}.result.warningTitle`, { count: warningRows.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">{t(`${ns}.result.line`)}</TableHead>
                    <TableHead>{t(`${ns}.result.email`)}</TableHead>
                    <TableHead>{t(`${ns}.result.warning`)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warningRows.slice(0, 50).map((row) => (
                    <TableRow key={row.line}>
                      <TableCell className="text-xs">{row.line}</TableCell>
                      <TableCell className="text-xs">{row.email}</TableCell>
                      <TableCell>
                        {row.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-foreground">{w}</p>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <Upload className="size-4" />
          {t(`${ns}.result.newImport`)}
        </Button>
        <Button onClick={() => navigate(backUrl || "/admin/customers")} className="gap-2">
          {t(`${ns}.result.viewCustomers`)}
        </Button>
      </div>
    </div>
  );
}
