import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ParsedRowPreview {
  _line: number;
  email: string;
  _valid: boolean;
  _errors: string[];
  _warnings: string[];
  _resolvedProducts: string[];
}

interface ImportPreviewTableProps {
  importType: "customers" | "contacts";
  rows: ParsedRowPreview[];
}

export function ImportPreviewTable({ importType, rows }: ImportPreviewTableProps) {
  const { t } = useTranslation();
  const ns = importType === "contacts" ? "contactImport" : "customerImport";

  const problemRows = rows
    .filter((r) => !r._valid || r._warnings.length > 0)
    .slice(0, 50);

  if (problemRows.length === 0) return null;

  return (
    <Card variant="bordered" className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {t(`${ns}.previewTable.title`)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[300px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-[60px]">{t(`${ns}.previewTable.line`)}</TableHead>
                <TableHead>{t(`${ns}.previewTable.email`)}</TableHead>
                <TableHead>{t(`${ns}.previewTable.problem`)}</TableHead>
                <TableHead>{t(`${ns}.previewTable.outcome`)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problemRows.map((row) => (
                <TableRow key={row._line}>
                  <TableCell className="text-xs">{row._line}</TableCell>
                  <TableCell className="text-xs">{row.email || "—"}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {row._errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive">{e}</p>
                      ))}
                      {row._warnings.map((w, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{w}</p>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {row._errors.length > 0 ? (
                      <span className="text-destructive">{t(`${ns}.previewTable.notProcessed`)}</span>
                    ) : importType === "customers" && row._resolvedProducts.length === 0 ? (
                      <span className="text-foreground">{t("customerImport.previewTable.noProduct")}</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
