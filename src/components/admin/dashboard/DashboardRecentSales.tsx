import { useTranslation } from "react-i18next";
import { ShoppingCart } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import type { RecentSale } from "@/hooks/useDashboardMetrics";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  approved: "green",
  completed: "blue",
};


interface Props {
  data: RecentSale[];
  loading: boolean;
}

export default function DashboardRecentSales({ data, loading }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <Card variant="bordered">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("dashboard.sections.recentSales")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <div className="size-10 rounded-full bg-secondary flex items-center justify-center mb-3">
              <ShoppingCart className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("dashboard.charts.noSalesYet")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((sale) => (
              <div key={sale.id} className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary">
                    {(sale.customer_name || sale.customer_email || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {sale.customer_name || sale.customer_email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sale.product_name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-foreground">
                    {sale.unit_amount === 0 ? t("common.free") : formatCurrency(sale.unit_amount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateTime(sale.effective_order_at, lang)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
