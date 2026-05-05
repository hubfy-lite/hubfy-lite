import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Copy, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import {
  DetailSection,
  DangerSection,
  DangerAction,
} from "@/components/admin/DetailPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import { useOrderDetail } from "@/hooks/useOrderDetail";
import { useOrderEmailLogs, type EmailLog } from "@/hooks/useOrderEmailLogs";
import { usePageTitle } from "@/hooks/usePageTitle";

/* ─── Helpers ─── */


function formatCurrency(amount: number, currency: string): string {
  const locale = currency === "BRL" ? "pt-BR" : currency === "EUR" ? "es" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "BRL",
  }).format(amount / 100);
}

const ORDER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending:    "amber",
  approved:   "green",
  completed:  "blue",
  refunded:   "gray",
  cancelled:  "red",
  disputed:   "purple",
  chargeback: "red",
};

function copyToClipboard(text: string, msg: string) {
  navigator.clipboard.writeText(text);
  toast.success(msg);
}

/* ─── Field: label ABOVE input ─── */

function InfoRow({
  label,
  value,
  copyable = false,
  copiedMsg = "Copiado!",
}: {
  label: string;
  value: string | number | null | undefined;
  copyable?: boolean;
  copiedMsg?: string;
}) {
  const display = value != null && value !== "" ? String(value) : "—";
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Input value={display} variant="readOnly" readOnly className="flex-1" />
        {copyable && value && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => copyToClipboard(String(value), copiedMsg)}
          >
            <Copy className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

type Tab = "details" | "payment" | "emails";

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const { order, loading } = useOrderDetail(orderId);
  // useOrderEmailLogs needs the UUID (FK), resolved from order
  const { data: emailLogs, isPending: emailsLoading } = useOrderEmailLogs(order?.id);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pageTitle = order
    ? `${order.customer_name} — ${order.product_name}`
    : undefined;
  usePageTitle(pageTitle);

  const handleDeleteOrder = async () => {
    if (!order?.id) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("orderDetail.deleteSuccess"));
      navigate("/admin/orders");
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("orderDetail.deleteError")));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-[1200px] 3xl:max-w-[1600px] space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (!order) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">{t("orderDetail.orderNotFound")}</p>
          <Button variant="outline" onClick={() => navigate("/admin/orders")}>
            <ArrowLeft className="size-4" />
            {t("orders.title")}
          </Button>
        </div>
      </div>
    );
  }

  /* ── Tabs config ── */
  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: t("orderSheet.tabDetails") },
    { id: "payment", label: t("orderSheet.tabPayment") },
    { id: "emails", label: t("orderSheet.tabEmails") },
  ];

  const copiedMsg = t("common.idCopied", "ID copiado!");

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-[1200px] 3xl:max-w-[1600px] space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0"
              onClick={() => navigate("/admin/orders")}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <h1 className="text-xl font-semibold min-w-0 truncate">{pageTitle}</h1>
            <Badge variant={ORDER_STATUS_VARIANTS[order.status] ?? ORDER_STATUS_VARIANTS.pending}>
              {t(`orders.statusLabels.${order.status}`, order.status)}
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList variant="line" className="shrink-0 border-b border-border w-full justify-start">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ─── Tab: Details ─── */}
            <TabsContent value="details" className="mt-8 space-y-0">
              {/* Order info */}
              <DetailSection
                title={t("orderDetail.cardOrder")}
                description={t("orderDetail.sectionOrderDesc")}
              >
                <InfoRow
                  label={t("common.id", { defaultValue: "ID" })}
                  value={order.public_id ?? orderId ?? null}
                  copyable
                  copiedMsg={copiedMsg}
                />
                <InfoRow
                  label={t("orderDetail.labelNumber")}
                  value={order.order_number ? `#${order.order_number}` : null}
                />
                <InfoRow
                  label={t("orderDetail.labelCreatedAt")}
                  value={formatDateTime(order.effective_order_at, lang)}
                />
                <InfoRow
                  label={t("common.type")}
                  value={order.type}
                />
                {order.is_order_bump && (
                  <InfoRow label="Order Bump" value="Sim" />
                )}
              </DetailSection>

              {/* Customer */}
              <DetailSection
                title={t("orderDetail.cardCustomer")}
                description={t("orderDetail.sectionCustomerDesc")}
                className="pt-8"
              >
                <InfoRow
                  label={t("common.id", { defaultValue: "ID" })}
                  value={order.customer_public_id}
                  copyable
                  copiedMsg={copiedMsg}
                />
                <InfoRow
                  label={t("common.name")}
                  value={order.customer_name}
                />
                <InfoRow
                  label={t("common.email")}
                  value={order.customer_email}
                />
                {order.customer_phone && (
                  <InfoRow
                    label={t("common.phone")}
                    value={order.customer_phone}
                  />
                )}
                {order.customer_document && (
                  <InfoRow
                    label={order.customer_document_type?.toUpperCase() ?? t("orderDetail.labelDocument")}
                    value={order.customer_document}
                  />
                )}
                {(order.customer_city || order.customer_region || order.customer_country) && (
                  <InfoRow
                    label={t("orderDetail.labelLocation")}
                    value={[order.customer_city, order.customer_region, order.customer_country].filter(Boolean).join(", ")}
                  />
                )}
              </DetailSection>

              {/* Product */}
              <DetailSection
                title={t("orderDetail.cardProduct")}
                description={t("orderDetail.sectionProductDesc")}
                className="pt-8"
              >
                <InfoRow
                  label={t("common.id", { defaultValue: "ID" })}
                  value={order.product_public_id}
                  copyable
                  copiedMsg={copiedMsg}
                />
                <InfoRow
                  label={t("common.name")}
                  value={order.product_name}
                />
                {order.product_benefit && (
                  <InfoRow
                    label={t("orderDetail.labelBenefit")}
                    value={order.product_benefit}
                  />
                )}
              </DetailSection>

              {/* Danger zone */}
              <DangerSection
                title={t("orderDetail.dangerZone")}
                description={t("orderDetail.sectionDangerDesc")}
                className="pt-8"
              >
                <DangerAction
                  title={t("orderDetail.deleteOrderTitle")}
                  description={t("orderDetail.deleteOrderHint")}
                >
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    {t("common.delete")}
                  </Button>
                </DangerAction>
              </DangerSection>
            </TabsContent>

            {/* ─── Tab: Payment ─── */}
            <TabsContent value="payment" className="mt-8 space-y-0">
              <DetailSection
                title={t("orderDetail.cardPayment")}
                description={t("orderDetail.sectionPaymentDesc")}
              >
                <InfoRow
                  label={t("orderDetail.labelAmount")}
                  value={formatCurrency(order.unit_amount, order.currency)}
                />
                <InfoRow
                  label={t("orderDetail.labelPaymentMethod")}
                  value={order.payment_method}
                />
                {order.gateway_external_id && (
                  <InfoRow
                    label="Gateway External ID"
                    value={order.gateway_external_id}
                    copyable
                    copiedMsg={copiedMsg}
                  />
                )}
                {order.subscription_status && (
                  <InfoRow
                    label={t("orderDetail.labelSubscription")}
                    value={order.subscription_status}
                  />
                )}
              </DetailSection>

              <DetailSection
                title={t("orderDetail.sectionTimestamps")}
                description={t("orderDetail.sectionTimestampsDesc")}
                className="pt-8"
              >
                <InfoRow
                  label={t("orderDetail.labelCreatedAt")}
                  value={formatDateTime(order.created_at, lang)}
                />
                <InfoRow
                  label={t("orderDetail.labelUpdatedAt")}
                  value={formatDateTime(order.updated_at, lang)}
                />
                {order.gateway_order_created_at && (
                  <InfoRow
                    label={t("orderDetail.labelGatewayCreatedAt")}
                    value={formatDateTime(order.gateway_order_created_at, lang)}
                  />
                )}
              </DetailSection>
            </TabsContent>

            {/* ─── Tab: Emails ─── */}
            <TabsContent value="emails" className="mt-8 space-y-0">
              <DetailSection
                title="Emails"
                description={t("orderDetail.sectionEmailsDesc")}
                className="border-b-0"
              >
                {emailsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !emailLogs || emailLogs.length === 0 ? (
                  <Card variant="bordered">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                        <Mail className="size-6 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">
                        {t("orderDetail.noEmailsSent")}
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        {t("orderDetail.noEmailsHint")}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {emailLogs.map((log: EmailLog) => (
                      <Card key={log.id} variant="bordered">
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary">
                                  {t(`emailLogs.type.${log.email_type}`, log.email_type)}
                                </Badge>
                                <Badge variant="outline">
                                  {t(`emailLogs.status.${log.status}`, log.status)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {log.recipient_email}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">
                              {formatDateTime(log.sent_at ?? log.created_at, lang)}
                            </p>
                          </div>
                          {log.error_message && (
                            <p className="mt-2 text-xs text-destructive">
                              {log.error_message}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </DetailSection>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orderDetail.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orderDetail.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("orderDetail.deleteOrderCta")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
