import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChartIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: Array<{ method: string; revenue: number }>;
  loading: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  pix: "hsl(var(--chart-1))",
  credit_card: "hsl(var(--chart-3))",
  billet: "hsl(var(--chart-4))",
  free: "hsl(var(--chart-2))",
  hotmart: "hsl(var(--chart-5))",
};

const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão",
  billet: "Boleto",
  free: "Gratuito",
  hotmart: "Hotmart",
  debit: "Débito",
  bank_transfer: "Transferência",
};

function buildChartConfig(data: Array<{ method: string }>): ChartConfig {
  const config: ChartConfig = {};
  for (const item of data) {
    config[item.method] = {
      label: METHOD_LABELS[item.method] ?? item.method,
      color: METHOD_COLORS[item.method] ?? "hsl(var(--chart-5))",
    };
  }
  return config;
}

export default function DashboardPaymentChart({ data, loading }: Props) {
  const { t } = useTranslation();
  const chartConfig = buildChartConfig(data);

  return (
    <Card variant="bordered">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("dashboard.charts.paymentMethods")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[220px] text-center">
            <div className="size-10 rounded-full bg-secondary flex items-center justify-center mb-3">
              <PieChartIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("dashboard.charts.noSalesYet")}</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value as number)}
                    nameKey="method"
                  />
                }
              />
              <Pie
                data={data}
                dataKey="revenue"
                nameKey="method"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.method}
                    fill={METHOD_COLORS[entry.method] ?? "hsl(var(--chart-5))"}
                  />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="method" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
