import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Mail,
  Eye,
  MousePointerClick,
  XCircle,
  AlertTriangle,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDateTime } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { useOrderDetail, type OrderDetail } from "@/hooks/useOrderDetail";
import { useOrderEmailLogs, type EmailLog } from "@/hooks/useOrderEmailLogs";
import type { Order } from "@/hooks/useOrders";

/* ─── Variants ─── */

const ORDER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending:    "amber",
  approved:   "green",
  completed:  "blue",
  refunded:   "gray",
  cancelled:  "red",
  disputed:   "purple",
  chargeback: "red",
};

const SUB_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  trialing:  "gray",
  active:    "green",
  past_due:  "red",
  paused:    "gray",
  cancelled: "red",
  expired:   "gray",
};

/* ─── Types ─── */

interface ReconcileResult {
  status: string;
  courses_granted?: number;
  courses_already_had?: number;
  courses_revoked?: number;
  email_sent?: boolean;
  error_message?: string | null;
}

/* ─── Helpers ─── */

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}


function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

const SOURCE_LABELS: Record<string, string> = {
  hubfy: "Hubfy",
  external_gateway: "Gateway externo",
  manual: "Manual",
  csv_import: "Importação CSV",
  api: "API",
  unknown: "Desconhecido",
};

function getOrderOrigin(detail: OrderDetail): string {
  if (detail.source && SOURCE_LABELS[detail.source]) return SOURCE_LABELS[detail.source];
  // Fallback for orders without source field
  if (detail.payment_method === "hotmart") return "Hotmart";
  if (detail.gateway_external_id) return "Gateway externo";
  return "Manual";
}

/* ─── InfoRow ─── */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm font-semibold text-foreground shrink-0">
        {label}
      </span>
      <span className="text-sm text-muted-foreground text-right break-all">
        {value}
      </span>
    </div>
  );
}

/* ─── Section card ─── */

function SectionCard({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Card variant="bordered" className={danger ? "ring-destructive/40" : ""}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle
          className={`text-base font-semibold ${danger ? "text-destructive" : "text-foreground"}`}
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

/* ─── Email status helpers ─── */

const EMAIL_STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; badgeVariant: BadgeVariant }
> = {
  sent: {
    icon: Mail,
    color: "text-zinc-500",
    badgeVariant: "gray",
  },
  delivered: {
    icon: CheckCircle2,
    color: "text-blue-600 dark:text-blue-400",
    badgeVariant: "blue",
  },
  opened: {
    icon: Eye,
    color: "text-emerald-600 dark:text-emerald-400",
    badgeVariant: "green",
  },
  clicked: {
    icon: MousePointerClick,
    color: "text-emerald-700 dark:text-emerald-300",
    badgeVariant: "green",
  },
  bounced: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    badgeVariant: "red",
  },
  complained: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    badgeVariant: "red",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    badgeVariant: "red",
  },
  skipped: {
    icon: SkipForward,
    color: "text-zinc-400 dark:text-zinc-500",
    badgeVariant: "gray",
  },
};

function EmailLogCard({
  log,
  t,
  lang,
}: {
  log: EmailLog;
  t: (key: string, opts?: Record<string, unknown>) => string;
  lang: string;
}) {
  const config = EMAIL_STATUS_CONFIG[log.status] ?? EMAIL_STATUS_CONFIG.sent;
  const StatusIcon = config.icon;

  return (
    <Card variant="bordered">
      <CardContent className="px-4 py-3 space-y-2">
        {/* Header: type + status */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-xs">
            {t(`emailLogs.type.${log.email_type}`, { defaultValue: log.email_type })}
          </Badge>
          <Badge variant={config.badgeVariant} className="text-xs gap-1">
            <StatusIcon className="size-3" />
            {t(`emailLogs.status.${log.status}`, { defaultValue: log.status })}
          </Badge>
        </div>

        {/* Details */}
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{log.recipient_email}</span>
          </div>

          {log.sent_at && (
            <InfoRow
              label={t("emailLogs.sentAt")}
              value={formatDateTime(log.sent_at, lang)}
            />
          )}
          {log.delivered_at && (
            <InfoRow
              label={t("emailLogs.deliveredAt")}
              value={formatDateTime(log.delivered_at, lang)}
            />
          )}
          {log.opened_at && (
            <InfoRow
              label={t("emailLogs.openedAt")}
              value={formatDateTime(log.opened_at, lang)}
            />
          )}
          {log.clicked_at && (
            <InfoRow
              label={t("emailLogs.clickedAt")}
              value={formatDateTime(log.clicked_at, lang)}
            />
          )}
          {log.error_message && (
            <p className={cn("text-xs mt-1", log.status === "skipped" ? "text-muted-foreground" : "text-destructive")}>
              {t(`emailLogs.errorMessage.${log.error_message}`, { defaultValue: log.error_message })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main component ─── */

interface OrderDetailSheetProps {
  orderId: string | null;
  previewData: Order | null;
  onOpenChange: (open: boolean) => void;
}

export default function OrderDetailSheet({
  orderId,
  previewData,
  onOpenChange,
}: OrderDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [activeTab, setActiveTab] = useState<"details" | "payment" | "emails">(
    "details"
  );
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);

  const open = !!orderId;

  const { order: detail } = useOrderDetail(orderId ?? undefined);
  // orderId is a public_id; email_logs FK and reconcile need the real UUID
  const orderUuid = detail?.id ?? previewData?.id ?? undefined;
  const { data: emailLogs, isLoading: emailLogsLoading } = useOrderEmailLogs(orderUuid);

  const order = detail ?? previewData;

  const handleTabChange = (value: string) => {
    setActiveTab(value as "details" | "payment" | "emails");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setActiveTab("details");
      setReconcileResult(null);
    }
    onOpenChange(isOpen);
  };

  const handleReconcileAccess = async () => {
    if (!orderUuid) return;
    setReconciling(true);
    setReconcileResult(null);
    try {
      const { data } = await invokeEdgeFunction<ReconcileResult>(
        "reconcile-access",
        {
          body: {
            order_id: orderUuid,
            trigger_source: "admin_button",
            force_resend_email: true,
          },
        },
      );
      setReconcileResult(data);
      if (data?.status === "ok") {
        toast.success(t("orderDetail.reconcileSuccess"));
      } else if (data?.status === "error") {
        toast.error(data.error_message || t("orderDetail.reconcileError"));
      }
    } catch (error: unknown) {
      toast.error(translateEdgeError(error));
    } finally {
      setReconciling(false);
    }
  };


  const triggerCls =
    "flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 pt-1 text-muted-foreground data-[state=active]:text-foreground hover:text-foreground transition-colors";

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="flex flex-col !max-w-[720px] !bg-card">
          {/* Header */}
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              {order ? (
                <>
                  {t("orders.titleSingle")} #{order.order_number ?? "—"}
                  <Badge variant={ORDER_STATUS_VARIANTS[order.status]}>
                    {t(`orders.statusLabels.${order.status}`)}
                  </Badge>
                </>
              ) : (
                <Skeleton className="h-6 w-40" />
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex flex-col flex-1 min-h-0 mt-4"
          >
            <TabsList className="w-full shrink-0 bg-transparent border-b border-border rounded-none p-0 h-auto gap-0">
              <TabsTrigger value="details" className={triggerCls}>
                {t("orderSheet.tabDetails")}
              </TabsTrigger>
              <TabsTrigger value="payment" className={triggerCls}>
                {t("orderSheet.tabPayment")}
              </TabsTrigger>
              <TabsTrigger value="emails" className={triggerCls}>
                {t("orderSheet.tabEmails")}
              </TabsTrigger>
            </TabsList>

            {/* ── Detalhes ── */}
            <TabsContent
              value="details"
              className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 mt-4 space-y-3 pb-6 pt-1"
            >
              {!order ? (
                <>
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-40 w-full rounded-lg" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                </>
              ) : (
                <>
                  {/* Pedido */}
                  <SectionCard title={t("orderDetail.cardOrder")}>
                    <div className="divide-y divide-border">
                      <InfoRow
                        label={t("common.id", { defaultValue: "ID" })}
                        value={detail?.public_id ?? order.public_id ?? "—"}
                      />
                      <InfoRow
                        label={t("orderDetail.labelNumber")}
                        value={order.order_number ?? "—"}
                      />
                      <InfoRow
                        label={t("orderDetail.labelCreatedAt")}
                        value={formatDateTime(order.effective_order_at, lang)}
                      />
                      {detail && (
                        <InfoRow
                          label={t("orderDetail.labelOrigin")}
                          value={getOrderOrigin(detail)}
                        />
                      )}
                    </div>
                  </SectionCard>

                  {/* Cliente */}
                  <SectionCard title={t("orderDetail.cardCustomer")}>
                    <div className="divide-y divide-border">
                      {detail?.customer_public_id && (
                        <InfoRow
                          label={t("common.id", { defaultValue: "ID" })}
                          value={detail.customer_public_id}
                        />
                      )}
                      <InfoRow
                        label={t("common.name")}
                        value={order.customer_name}
                      />
                      <InfoRow
                        label={t("common.email")}
                        value={order.customer_email}
                      />
                      {detail?.customer_phone && (
                        <InfoRow
                          label={t("common.phone")}
                          value={detail.customer_phone}
                        />
                      )}
                      {detail?.customer_document && (
                        <InfoRow
                          label={
                            detail.customer_document_type ??
                            t("orderDetail.labelDocument")
                          }
                          value={detail.customer_document}
                        />
                      )}
                      {(detail?.customer_city ||
                        detail?.customer_region ||
                        detail?.customer_country) && (
                        <InfoRow
                          label={t("orderDetail.labelLocation")}
                          value={[
                            detail.customer_city,
                            detail.customer_region,
                            detail.customer_country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        />
                      )}
                    </div>
                  </SectionCard>

                  {/* Produto */}
                  <SectionCard title={t("orderDetail.cardProduct")}>
                    <div className="divide-y divide-border">
                      {detail?.product_public_id && (
                        <InfoRow
                          label={t("common.id", { defaultValue: "ID" })}
                          value={detail.product_public_id}
                        />
                      )}
                      <InfoRow
                        label={t("common.name")}
                        value={truncate(order.product_name, 60)}
                      />
                      {order.product_benefit && (
                        <InfoRow
                          label={t("orders.columns.type")}
                          value={t(
                            `orders.benefitLabels.${order.product_benefit}`,
                            { defaultValue: order.product_benefit }
                          )}
                        />
                      )}
                      {order.is_order_bump && (
                        <InfoRow
                          label="Order Bump"
                          value={
                            <Badge variant="outline" className="text-xs">
                              Sim
                            </Badge>
                          }
                        />
                      )}
                    </div>
                  </SectionCard>

                  {/* Acesso (só para orders ativas) */}
                  {(order.status === "approved" || order.status === "completed") && (
                    <SectionCard title={t("orderDetail.cardAccess")}>
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReconcileAccess}
                          disabled={reconciling}
                          className="w-full gap-2"
                        >
                          {reconciling ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          {t("orderDetail.reconcileCta")}
                        </Button>

                        {reconcileResult && (
                          <div className="space-y-1.5 text-sm">
                            {reconcileResult.status === "ok" && (
                              <>
                                {(reconcileResult.courses_granted ?? 0) > 0 && (
                                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-3.5 shrink-0" />
                                    {t("orderDetail.reconcileCoursesGranted", {
                                      count: reconcileResult.courses_granted,
                                    })}
                                  </div>
                                )}
                                {(reconcileResult.courses_already_had ?? 0) > 0 && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <CheckCircle2 className="size-3.5 shrink-0" />
                                    {t("orderDetail.reconcileCoursesAlready", {
                                      count: reconcileResult.courses_already_had,
                                    })}
                                  </div>
                                )}
                                {reconcileResult.email_sent && (
                                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-3.5 shrink-0" />
                                    {t("orderDetail.reconcileEmailSent")}
                                  </div>
                                )}
                              </>
                            )}
                            {reconcileResult.status === "error" && (
                              <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="size-3.5 shrink-0" />
                                {reconcileResult.error_message || t("orderDetail.reconcileError")}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  )}

                </>
              )}
            </TabsContent>

            {/* ── Pagamento ── */}
            <TabsContent
              value="payment"
              className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 mt-4 space-y-3 pb-6 pt-1"
            >
              {!detail ? (
                <Skeleton className="h-60 w-full rounded-lg" />
              ) : (
                <SectionCard title={t("orderDetail.cardPayment")}>
                  <div className="divide-y divide-border">
                    <InfoRow
                      label={t("orderDetail.labelAmount")}
                      value={
                        detail.unit_amount === 0
                          ? t("common.free")
                          : formatCurrency(detail.unit_amount, detail.currency)
                      }
                    />
                    <InfoRow
                      label={t("orderDetail.labelCurrency")}
                      value={detail.currency.toUpperCase()}
                    />
                    <InfoRow
                      label={t("orderDetail.labelPaymentMethod")}
                      value={
                        <Badge variant="outline" className="text-xs">
                          {t(
                            `orderDetail.paymentMethodLabels.${detail.payment_method}`,
                            { defaultValue: detail.payment_method }
                          )}
                        </Badge>
                      }
                    />
                    <InfoRow
                      label={t("common.status")}
                      value={
                        <Badge
                          variant={ORDER_STATUS_VARIANTS[detail.status]}
                          className="text-xs"
                        >
                          {t(`orders.statusLabels.${detail.status}`)}
                        </Badge>
                      }
                    />
                    <InfoRow
                      label={t("orders.columns.type")}
                      value={
                        <Badge variant="outline" className="text-xs">
                          {t(`orders.typeLabels.${detail.type}`)}
                        </Badge>
                      }
                    />
                    {detail.subscription_status && (
                      <InfoRow
                        label={t("orderDetail.labelSubscription")}
                        value={
                          <Badge
                            variant={
                              SUB_STATUS_VARIANTS[
                                detail.subscription_status
                              ] ?? "outline"
                            }
                            className="text-xs"
                          >
                            {t(
                              `orders.subStatusLabels.${detail.subscription_status}`
                            )}
                          </Badge>
                        }
                      />
                    )}
                    <InfoRow
                      label={t("orderDetail.labelCreatedAt")}
                      value={formatDateTime(detail.effective_order_at, lang)}
                    />
                    <InfoRow
                      label={t("orderDetail.labelUpdatedAt")}
                      value={formatDateTime(detail.updated_at, lang)}
                    />
                    {detail.gateway_external_id && (
                      <InfoRow
                        label={t("orderDetail.labelGatewayId")}
                        value={detail.gateway_external_id}
                      />
                    )}
                  </div>
                </SectionCard>
              )}
            </TabsContent>

            {/* ── Emails ── */}
            <TabsContent
              value="emails"
              className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 mt-4 space-y-3 pb-6 pt-1"
            >
              {emailLogsLoading ? (
                <>
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </>
              ) : !emailLogs || emailLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Mail className="size-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    {t("emailLogs.noEmails")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("emailLogs.noEmailsHint")}
                  </p>
                </div>
              ) : (
                emailLogs.map((log) => (
                  <EmailLogCard key={log.id} log={log} t={t} lang={lang} />
                ))
              )}
            </TabsContent>

          </Tabs>
        </SheetContent>
      </Sheet>

    </>
  );
}
