import { useEffect, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGatewayLogDetails } from "@/hooks/useGatewayLogs";
import type {
  useGatewayLogs,
  GatewayLogsFilters,
  WebhookLogStatus,
} from "@/hooks/useGatewayLogs";

type LogsProps = ReturnType<typeof useGatewayLogs>;

interface GatewayLogsTabProps extends LogsProps {
  filters: GatewayLogsFilters;
  onFiltersChange: (filters: GatewayLogsFilters) => void;
}

/* ─── Badge de status ─── */

const STATUS_VARIANTS: Record<WebhookLogStatus, BadgeVariant> = {
  received: "gray",
  processing: "amber",
  processed: "green",
  failed: "red",
  ignored: "gray",
  duplicate: "gray",
  unauthorized: "red",
  invalid_payload: "red",
};

function StatusBadge({ status }: { status: WebhookLogStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
      {t(`integrations.logs.status.${status}`)}
    </Badge>
  );
}

/* ─── Bloco de payload com botão copiar ─── */

function PayloadBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </div>
      <pre className="max-h-48 overflow-y-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-all">
        {content}
      </pre>
    </div>
  );
}

/* ─── Linha expandível ─── */

function LogRow({
  log,
  onReprocess,
  reprocessPending,
}: {
  log: LogsProps["logs"][number];
  onReprocess: (id: string) => void;
  reprocessPending: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data: details, isLoading: detailsLoading } = useGatewayLogDetails(
    log.id,
    expanded,
  );

  const formattedDate = format(new Date(log.created_at), "dd/MM/yy HH:mm", {
    locale: ptBR,
  });
  const errorMessage = details?.error_message ?? log.error_message;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="w-6 py-2 pr-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="py-2">
          <StatusBadge status={log.status} />
        </TableCell>
        <TableCell className="py-2 text-sm">
          {log.buyer_email ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="py-2 text-sm">
          {log.external_event_type ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {log.external_event_type}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="py-2 text-sm">
          {log.external_offer_id ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {log.external_offer_id}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="py-2 text-sm text-muted-foreground">
          {formattedDate}
        </TableCell>
        <TableCell
          className="py-2 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          {log.status === "failed" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={reprocessPending}
              onClick={() => onReprocess(log.id)}
            >
              {reprocessPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {t("integrations.logs.reprocess")}
            </Button>
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="py-3">
            {detailsLoading ? (
              <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-2 overflow-hidden">
                {/* Mensagem de erro */}
                {errorMessage && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-destructive">
                      {t("integrations.logs.error")}
                    </p>
                    <pre className="rounded bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap break-all">
                      {errorMessage}
                    </pre>
                  </div>
                )}

                {/* Resultado */}
                {details?.result && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t("integrations.logs.result")}
                    </p>
                    <pre className="rounded bg-muted p-2 text-xs whitespace-pre-wrap break-all">
                      {JSON.stringify(details.result, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Payload bruto */}
                <PayloadBlock
                  label={t("integrations.logs.payload")}
                  content={JSON.stringify(details?.raw_payload ?? {}, null, 2)}
                />
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ─── Tab principal de logs ─── */

export default function GatewayLogsTab({
  logs,
  isLoading,
  refreshLogs,
  isRefreshing,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  reprocessLog,
  filters,
  onFiltersChange,
}: GatewayLogsTabProps) {
  const { t } = useTranslation();
  const [emailInput, setEmailInput] = useState(filters.email ?? "");

  useEffect(() => {
    setEmailInput(filters.email ?? "");
  }, [filters.email]);

  function applyEmailSearch() {
    onFiltersChange({
      ...filters,
      email: emailInput.trim().toLowerCase(),
    });
  }

  function handleEmailInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyEmailSearch();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("integrations.logs.filterEmail")}
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            onKeyDown={handleEmailInputKeyDown}
          />
        </div>

        <Select
          value={filters.status || "all"}
          onValueChange={(val) =>
            onFiltersChange({
              ...filters,
              status: val === "all" ? "" : (val as WebhookLogStatus),
            })
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="received">{t("integrations.logs.status.received")}</SelectItem>
            <SelectItem value="processing">{t("integrations.logs.status.processing")}</SelectItem>
            <SelectItem value="processed">{t("integrations.logs.status.processed")}</SelectItem>
            <SelectItem value="failed">{t("integrations.logs.status.failed")}</SelectItem>
            <SelectItem value="ignored">{t("integrations.logs.status.ignored")}</SelectItem>
            <SelectItem value="duplicate">{t("integrations.logs.status.duplicate")}</SelectItem>
            <SelectItem value="unauthorized">{t("integrations.logs.status.unauthorized")}</SelectItem>
            <SelectItem value="invalid_payload">{t("integrations.logs.status.invalid_payload")}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => refreshLogs()}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {t("integrations.logs.refresh")}
        </Button>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-0">
              {/* Skeleton header */}
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
              {/* Skeleton rows */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0"
                >
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12 ml-auto" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-body">{t("integrations.logs.empty")}</p>
              <p className="text-support text-sm">{t("integrations.logs.emptyDescription")}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("common.email")}</TableHead>
                    <TableHead>{t("integrations.logs.event")}</TableHead>
                    <TableHead>{t("integrations.logs.offerId")}</TableHead>
                    <TableHead>{t("integrations.logs.date")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <LogRow
                      key={log.id}
                      log={log}
                      onReprocess={(id) => reprocessLog.mutate(id)}
                      reprocessPending={
                        reprocessLog.isPending && reprocessLog.variables === log.id
                      }
                    />
                  ))}
                </TableBody>
              </Table>

              {hasNextPage && (
                <div className="flex items-center justify-center border-t border-border p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("integrations.logs.loadMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-support text-xs text-right">
        {t("integrations.logs.manualRefreshHint")}
      </p>
    </div>
  );
}
