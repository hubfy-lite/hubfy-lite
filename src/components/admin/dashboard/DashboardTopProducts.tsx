import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import type { TopProduct } from "@/hooks/useDashboardMetrics";

interface Props {
  data: TopProduct[];
  loading: boolean;
}

export default function DashboardTopProducts({ data, loading }: Props) {
  const { t } = useTranslation();

  const maxRevenue = data.length > 0 ? Math.max(...data.map((p) => p.revenue)) : 0;

  return (
    <Card variant="bordered">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("dashboard.sections.topProducts")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <div className="size-10 rounded-full bg-secondary flex items-center justify-center mb-3">
              <Package className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("dashboard.charts.noSalesYet")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((product, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground truncate">{product.product_name}</span>
                  <span className="text-sm font-medium text-foreground shrink-0">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{ width: `${maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 w-12 text-right">
                    {product.sales_count} {t("dashboard.sections.sales")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
