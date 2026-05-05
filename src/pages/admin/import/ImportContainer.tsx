import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Upload,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Info,
  Sheet as SheetIcon,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/hooks/useProducts";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  useCustomerImport,
  type ImportRow,
  type ImportRowResult,
} from "@/hooks/useCustomerImport";
import { ImportInstructionsCard } from "./ImportInstructionsCard";
import { ImportUploadArea } from "./ImportUploadArea";
import { ImportPreviewStats } from "./ImportPreviewStats";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { ImportProgress } from "./ImportProgress";
import { ImportResultView } from "./ImportResultView";

/* ─── Constants ─── */

const MAX_ROWS = 2000;
const REQUIRED_COLUMNS = ["email", "name"];
const CUSTOMER_REQUIRED_COLUMNS = ["email", "name", "product_ids"];
const CUSTOMER_OPTIONAL_COLUMNS = [
  "first_name",
  "last_name",
  "phone_country_code",
  "phone",
  "city",
  "state",
  "country",
  "document_type",
  "document",
  "external_id",
];
const CONTACT_OPTIONAL_COLUMNS = [
  "first_name",
  "last_name",
  "phone_country_code",
  "phone",
  "city",
  "state",
  "country",
  "document_type",
  "document",
  "external_id",
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_DOCUMENT_TYPES = ["CPF", "CNPJ", "PASSPORT", "DNI", "ID", "RUT", "EIN", "VAT"];

/* ─── Types ─── */

interface ParsedRow extends ImportRow {
  _line: number;
  _valid: boolean;
  _errors: string[];
  _warnings: string[];
  _resolvedProducts: string[];
  _unresolvedProducts: string[];
}

type Step = "upload" | "result";

/* ─── Component ─── */

interface ImportContainerProps {
  importType: "customers" | "contacts";
  backUrl?: string;
}

export function ImportContainer({ importType, backUrl }: ImportContainerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { products } = useProducts();
  const { importCustomers, loading, result, error, reset } = useCustomerImport();
  const ns = importType === "contacts" ? "contactImport" : "customerImport";

  const OPTIONAL_COLUMNS = importType === "customers" ? CUSTOMER_OPTIONAL_COLUMNS : CONTACT_OPTIONAL_COLUMNS;
  const REQ_COLS = importType === "customers" ? CUSTOMER_REQUIRED_COLUMNS : REQUIRED_COLUMNS;
  const ALL_COLUMNS = [...REQ_COLS, ...OPTIONAL_COLUMNS];

  const [schemaOpen, setSchemaOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewRejectedRows, setPreviewRejectedRows] = useState<ImportRowResult[]>([]);
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Gateway mappings (only needed for customers mode)
  const { data: gatewayMappings = [] } = useQuery({
    queryKey: ["gateway-product-mappings-import", tenant?.id],
    enabled: !!tenant?.id && importType === "customers",
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_product_mappings")
        .select("product_id, external_product_id, integration:tenant_integrations!inner(tenant_id)")
        .eq("integration.tenant_id", tenant!.id);
      return data ?? [];
    },
  });

  // Product resolution (customers mode only)
  const resolveProductToken = useCallback(
    (token: string): { name: string | null; error?: string } => {
      const byPublicId = products.find((p) => p.public_id === token);
      if (byPublicId) return { name: byPublicId.name };

      const matchingProductIds = [
        ...new Set(
          gatewayMappings
            .filter((m) => m.external_product_id === token)
            .map((m) => m.product_id),
        ),
      ];
      if (matchingProductIds.length === 1) {
        const matched = products.find((p) => p.id === matchingProductIds[0]);
        if (matched) return { name: matched.name };
      }
      if (matchingProductIds.length > 1)
        return { name: null, error: `"${token}" ambíguo (${matchingProductIds.length} produtos)` };

      return { name: null, error: `Produto "${token}" não encontrado.` };
    },
    [products, gatewayMappings],
  );

  const validateRow = useCallback(
    (row: Record<string, string>, lineNum: number): ParsedRow => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const resolved: string[] = [];
      const unresolved: string[] = [];

      const email = (row.email || "").trim().toLowerCase();
      if (!email || !EMAIL_RE.test(email)) errors.push("Email inválido");

      const name = (row.name || "").trim();
      if (!name) errors.push("Nome é obrigatório");

      // Products handling depends on mode
      const productsRaw = (row.product_ids || "").trim();

      if (importType === "customers") {
        if (productsRaw) {
          const tokens = [
            ...new Set(
              productsRaw
                .split(",")
                .map((tok) => tok.trim())
                .filter(Boolean),
            ),
          ];
          for (const token of tokens) {
            const { name: pName, error } = resolveProductToken(token);
            if (pName) resolved.push(`${token} (${pName})`);
            else {
              unresolved.push(token);
              warnings.push(error || `Produto "${token}" não encontrado.`);
            }
          }
        }

        if (!productsRaw) {
          errors.push("Coluna product_ids vazia. Pelo menos 1 produto é obrigatório.");
        } else if (resolved.length === 0 && unresolved.length > 0) {
          errors.push("Nenhum produto resolvido. Verifique os IDs na coluna product_ids.");
        }
      }

      // ── Silent normalization ──
      const rawPhoneCCDigits = (row.phone_country_code || "").replace(/[^0-9]/g, "");
      const rawPhoneCC = rawPhoneCCDigits.length >= 1 && rawPhoneCCDigits.length <= 4 ? rawPhoneCCDigits : null;
      const rawPhone = (row.phone || "").replace(/[^0-9]/g, "") || null;
      const rawStateLetters = (row.state || "").replace(/[^A-Za-z]/g, "").toUpperCase();
      const normalizedState = rawStateLetters.length === 2 ? rawStateLetters : null;
      const rawDocTypeStr = (row.document_type || "").trim().toUpperCase();
      const rawDocType = rawDocTypeStr && VALID_DOCUMENT_TYPES.includes(rawDocTypeStr) ? rawDocTypeStr : null;
      const rawDoc = (row.document || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || null;

      return {
        email,
        name,
        product_ids: productsRaw || null,
        first_name: (row.first_name || "").trim() || null,
        last_name: (row.last_name || "").trim() || null,
        phone_country_code: rawPhoneCC,
        phone: rawPhone,
        city: (row.city || "").trim() || null,
        state: normalizedState,
        country: (row.country || "").trim() || null,
        document_type: rawDocType,
        document: rawDoc,
        external_id: (row.external_id || "").trim() || null,
        _line: lineNum,
        _valid: errors.length === 0,
        _errors: errors,
        _warnings: warnings,
        _resolvedProducts: resolved,
        _unresolvedProducts: unresolved,
      };
    },
    [importType, resolveProductToken],
  );

  const checkExistingEmails = useCallback(
    async (emails: string[]) => {
      if (!tenant?.id || emails.length === 0) return;
      setCheckingDuplicates(true);
      try {
        const found = new Set<string>();
        for (let i = 0; i < emails.length; i += 200) {
          const chunk = emails.slice(i, i + 200);
          const { data } = await supabase
            .from("customers")
            .select("email")
            .eq("tenant_id", tenant.id)
            .in("email", chunk);
          if (data) {
            for (const row of data) found.add(row.email);
          }
        }
        setExistingEmails(found);
      } catch {
        setExistingEmails(new Set());
      } finally {
        setCheckingDuplicates(false);
      }
    },
    [tenant?.id],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setParsedRows([]);
    setFilename(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        const headers = results.meta.fields || [];
        const normalizedHeaders = headers.map((h) =>
          h.trim().toLowerCase().replace(/\s+/g, "_"),
        );

        // Check required columns
        const reqCols = importType === "customers" ? CUSTOMER_REQUIRED_COLUMNS : REQUIRED_COLUMNS;
        const missing = reqCols.filter((col) => !normalizedHeaders.includes(col));
        if (missing.length > 0) {
          setParseError(
            `Colunas obrigatórias ausentes: ${missing.join(", ")}`,
          );
          return;
        }

        const data = results.data as Record<string, string>[];
        if (data.length === 0) {
          setParseError("O arquivo não contém linhas de dados");
          return;
        }
        if (data.length > MAX_ROWS) {
          setParseError(
            `O arquivo tem ${data.length} linhas. O limite é ${MAX_ROWS} linhas por importação.`,
          );
          return;
        }

        // Normalize headers — only keep known columns, ignore the rest
        const normalized = data.map((row) => {
          const newRow: Record<string, string> = {};
          for (const [key, val] of Object.entries(row)) {
            const nKey = key.trim().toLowerCase().replace(/\s+/g, "_");
            if (ALL_COLUMNS.includes(nKey)) {
              newRow[nKey] = val;
            }
          }
          return newRow;
        });

        // Contacts mode: block entire file if ANY row has product_ids data
        if (importType === "contacts") {
          const hasAnyProducts = normalized.some(
            (row) => (row.product_ids || "").trim().length > 0,
          );
          if (hasAnyProducts) {
            setParseError(
              "Coluna product_ids preenchida. Na importação de contatos, produtos não são permitidos. Para conceder acesso a produtos, use a importação de customers.",
            );
            return;
          }
        }

        const parsed = normalized.map((row, i) => validateRow(row, i + 2));

        // Mark duplicate emails
        const seenEmails = new Set<string>();
        for (const row of parsed) {
          if (!row.email) continue;
          if (seenEmails.has(row.email)) {
            row._valid = false;
            row._errors.push("Email duplicado no CSV (já apareceu em linha anterior)");
          } else {
            seenEmails.add(row.email);
          }
        }

        setParsedRows(parsed);

        // Check which emails already exist
        const validEmails = parsed
          .filter((r) => r._valid)
          .map((r) => r.email);
        checkExistingEmails(validEmails);
      },
      error: (err) => {
        setParseError(`Erro ao ler CSV: ${err.message}`);
      },
    });

    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!tenant?.id) {
      toast.error("Workspace não identificado");
      return;
    }

    const validRows: ImportRow[] = parsedRows
      .filter((r) => r._valid)
      .map(({ _line, _valid, _errors, _warnings, _resolvedProducts, _unresolvedProducts, ...row }) => row);

    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }

    const rejectedInPreview = parsedRows
      .filter((r) => !r._valid)
      .map((r) => ({
        line: r._line,
        email: r.email || "—",
        status: "error" as const,
        customer_action: "error",
        orders_created: [] as string[],
        orders_skipped: [] as string[],
        warnings: r._warnings,
        errors: r._errors,
      }));
    setPreviewRejectedRows(rejectedInPreview);

    const importResult = await importCustomers(validRows, filename, tenant.id, importType);
    if (importResult) {
      setStep("result");
      toast.success(
        `Importação concluída: ${importResult.created_count} criados, ${importResult.updated_count} atualizados`,
      );
      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ["tenant-customers", tenant.id] });
    }
  };

  const handleReset = () => {
    setStep("upload");
    setParsedRows([]);
    setFilename("");
    setParseError(null);
    setPreviewRejectedRows([]);
    setExistingEmails(new Set());
    reset();
  };

  const handleDownloadTemplate = () => {
    if (importType === "customers") {
      const cols = [...CUSTOMER_REQUIRED_COLUMNS, ...CUSTOMER_OPTIONAL_COLUMNS];
      const csvContent = cols.join(",") + "\n" +
        "aluno@exemplo.com,Aluno Exemplo,prod_xxx,Aluno,,55,11999999999,São Paulo,SP,BR,CPF,00000000000,ext_123\n";
      downloadCsv(csvContent, "modelo-importacao-customers-hubfy.csv");
    } else {
      const cols = [...REQUIRED_COLUMNS, ...CONTACT_OPTIONAL_COLUMNS];
      const csvContent = cols.join(",") + "\n" +
        "contato@exemplo.com,Contato Exemplo,Contato,,55,11999999999,São Paulo,SP,BR,CPF,00000000000,ext_123\n";
      downloadCsv(csvContent, "modelo-importacao-contatos-hubfy.csv");
    }
  };

  // Stats
  const totalRows = parsedRows.length;
  const validRows = parsedRows.filter((r) => r._valid).length;
  const invalidRows = totalRows - validRows;
  const withProducts = parsedRows.filter((r) => r._resolvedProducts.length > 0).length;
  const unresolvedCount = parsedRows.reduce(
    (acc, r) => acc + r._unresolvedProducts.length,
    0,
  );
  const unresolvedRowCount = parsedRows.filter((r) => r._unresolvedProducts.length > 0).length;
  const existingCount = parsedRows.filter(
    (r) => r._valid && existingEmails.has(r.email),
  ).length;
  const newCount = validRows - existingCount;

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(backUrl || "/admin/customers")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">
              {t(`${ns}.title`)}
            </h1>
          </div>
          {importType === "customers" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSchemaOpen(true)}
              className="gap-2 shrink-0"
            >
              <SheetIcon className="size-3.5" />
              {t("customerImport.viewSchema")}
            </Button>
          )}
        </div>

        {step === "upload" && (
          <>
            <ImportInstructionsCard
              importType={importType}
              maxRows={MAX_ROWS}
              onDownloadTemplate={handleDownloadTemplate}
            />

            <ImportUploadArea
              filename={filename}
              maxRows={MAX_ROWS}
              ns={ns}
              onFileChange={handleFileChange}
              onReset={handleReset}
            />

            {/* Parse Error */}
            {parseError && (
              <Card variant="bordered" className="border-destructive/40">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Erro no arquivo
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {parseError}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview */}
            {parsedRows.length > 0 && !parseError && (
              <>
                <ImportPreviewStats
                  importType={importType}
                  totalRows={totalRows}
                  validRows={validRows}
                  invalidRows={invalidRows}
                  withProducts={withProducts}
                />

                {/* Duplicate check banner */}
                {checkingDuplicates && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                    <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {t(`${ns}.progress.msg3`)}
                    </p>
                  </div>
                )}
                {!checkingDuplicates && existingCount > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                    <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      {t(`${ns}.duplicateWarning`, { count: existingCount })}{" "}
                      {t(`${ns}.duplicateNote`)}
                      {newCount > 0 && <>{" "}{t(`${ns}.newCustomers`, { count: newCount })}</>}
                    </p>
                  </div>
                )}

                {importType === "customers" && unresolvedCount > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      {t("customerImport.unresolvedWarning", { rowCount: unresolvedRowCount, count: unresolvedCount })}
                    </p>
                  </div>
                )}

                {/* Preview Table */}
                {!loading && (invalidRows > 0 || unresolvedCount > 0) && (
                  <ImportPreviewTable
                    importType={importType}
                    rows={parsedRows}
                  />
                )}

                {/* Confirm / Progress */}
                {loading ? (
                  <ImportProgress importType={importType} rowCount={validRows} />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                      {t(`${ns}.confirmText`, { count: validRows })}
                      {invalidRows > 0 &&
                        ` ${t(`${ns}.errorText`, { count: invalidRows })}`}
                    </p>
                    <Button
                      onClick={handleConfirmImport}
                      disabled={validRows === 0}
                      className="gap-2 shrink-0"
                    >
                      <Upload className="size-4" />
                      {t(`${ns}.confirmButton`)}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Import Error */}
            {error && (
              <Card variant="bordered" className="border-destructive/40">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        {t(`${ns}.errorTitle`)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Result Step */}
        {step === "result" && result && (
          <ImportResultView
            importType={importType}
            result={result}
            previewRejectedRows={previewRejectedRows}
            onReset={handleReset}
            backUrl={backUrl}
          />
        )}
      </div>

      {/* Schema Sheet */}
      {importType === "customers" && (
        <SchemaSheet open={schemaOpen} onOpenChange={setSchemaOpen} />
      )}
    </div>
  );
}

/* ─── Schema Sheet ─── */

const SCHEMA_COLUMNS = [
  { key: "email", required: true },
  { key: "name", required: true },
  { key: "product_ids", required: true },
  { key: "first_name", required: false },
  { key: "last_name", required: false },
  { key: "phone_country_code", required: false },
  { key: "phone", required: false },
  { key: "city", required: false },
  { key: "state", required: false },
  { key: "country", required: false },
  { key: "document_type", required: false },
  { key: "document", required: false },
  { key: "external_id", required: false },
];

function SchemaSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{t("customerImport.schemaTitle")}</SheetTitle>
          <SheetDescription>{t("customerImport.schemaSubtitle")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {SCHEMA_COLUMNS.map(({ key, required }) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t(`customerImport.schemaRows.${key}.field` as any)}
                  </span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {key}
                  </code>
                </div>
                <Badge
                  variant={required ? "default" : "secondary"}
                  className="text-[10px] shrink-0"
                >
                  {required
                    ? t("customerImport.schemaRequired")
                    : t("customerImport.schemaOptional")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(`customerImport.schemaRows.${key}.description` as any)}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {t("customerImport.schemaHeaders.type")}: {t(`customerImport.schemaRows.${key}.type` as any)}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
