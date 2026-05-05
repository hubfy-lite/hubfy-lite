import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: Array<{ day: string; revenue: number }>;
  loading: boolean;
}

const chartConfig: ChartConfig = {
  revenue: {
    label: "Receita",
    color: "hsl(var(--chart-1))",
  },
};

export default function DashboardRevenueChart({ data, loading }: Props) {
  const { t } = useTranslation();

  return (
    <Card variant="bordered">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("dashboard.charts.revenueOverTime")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : data.length === 0 || data.every((d) => d.revenue === 0) ? (
          <div className="flex flex-col items-center justify-center h-[220px] text-center">
            <div className="size-10 rounded-full bg-secondary flex items-center justify-center mb-3">
              <BarChart3 className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("dashboard.charts.noSalesYet")}</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickFormatter={(v: number) => formatCurrency(v).replace("R$\u00a0", "R$")}
                width={70}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value as number)}
                    nameKey="revenue"
                  />
                }
              />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
