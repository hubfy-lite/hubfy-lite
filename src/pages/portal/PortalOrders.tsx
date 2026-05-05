import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { usePortal } from "@/contexts/PortalContext";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import PortalLayout from "@/components/portal/PortalLayout";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ORDER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending:    "amber",
  approved:   "green",
  completed:  "blue",
  refunded:   "gray",
  cancelled:  "red",
  disputed:   "purple",
  chargeback: "red",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(amount / 100);
}


export default function PortalOrders() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { customer } = usePortal();
  const { data: orders, isLoading } = useCustomerOrders(customer.id);

  return (
    <PortalLayout>
      <div className="space-y-6 px-4 pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("portal.orders.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("portal.orders.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !orders?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">{t("portal.orders.empty")}</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("portal.orders.product")}</TableHead>
                  <TableHead>{t("portal.orders.amount")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("portal.orders.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.product?.name || "—"}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(order.unit_amount, order.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ORDER_STATUS_VARIANTS[order.status]}>
                        {t(`orders.statusLabels.${order.status}`, order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(order.effective_order_at, lang)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
