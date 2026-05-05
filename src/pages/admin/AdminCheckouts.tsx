import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { translateAppError } from "@/lib/app-error-utils";

import { TableSkeleton } from "@/components/admin/TableSkeleton";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCheckouts, type Checkout } from "@/hooks/useCheckouts";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "gray",
  active: "green",
  inactive: "gray",
};

const MONTH_KEYS = [
  "checkouts.months.jan", "checkouts.months.feb", "checkouts.months.mar",
  "checkouts.months.apr", "checkouts.months.may", "checkouts.months.jun",
  "checkouts.months.jul", "checkouts.months.aug", "checkouts.months.sep",
  "checkouts.months.oct", "checkouts.months.nov", "checkouts.months.dec",
];

function formatCreatedAt(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = t(MONTH_KEYS[d.getMonth()]);
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return t("checkouts.dateFormat", { day, month, year, hours, minutes });
}

export default function AdminCheckouts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { checkouts, loading, updateCheckout } =
    useCheckouts(debouncedSearch);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const getCheckoutUrl = useCallback(
    (checkout: Checkout) => {
      return `${window.location.origin}/checkout/${checkout.smart_id}`;
    },
    []
  );

  const handleCopyUrl = (checkout: Checkout) => {
    const url = getCheckoutUrl(checkout);
    navigator.clipboard.writeText(url);
    toast.success(t("common.urlCopied"));
  };

  const handleToggleStatus = async (checkout: Checkout) => {
    const newStatus = checkout.status === "active" ? "inactive" : "active";
    try {
      await updateCheckout(checkout.id, { status: newStatus });
      toast.success(
        newStatus === "active" ? t("checkouts.actions.activated") : t("checkouts.actions.deactivated")
      );
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("checkouts.actions.statusError")));
    }
  };

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
        {/* Header */}
        <div className="flex min-w-0 shrink-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal text-foreground md:text-2xl">
              {t("checkouts.title")}
            </h1>
            <Button
              onClick={() => navigate("/admin/checkouts/new")}
              size="sm"
              className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
            >
              <Plus className="size-3.5 md:size-4" />
              <span className="md:hidden">Add</span>
              <span className="hidden md:inline">{t("checkouts.newCheckout")}</span>
            </Button>
          </div>

          {/* Search */}
          <div className="min-w-0 w-full">
            <div className="relative w-full min-w-0 max-w-none sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
              <Input
                placeholder={t("checkouts.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-8 text-sm md:h-10 md:pl-9"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : checkouts.length === 0 ? (
          <Card variant="bordered">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <CreditCard className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("checkouts.emptyTitle")}
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                {t("checkouts.emptyDescription")}
              </p>
              <Button onClick={() => navigate("/admin/checkouts/new")}>
                <Plus className="size-4" />
                {t("checkouts.createFirst")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card variant="bordered" className="min-w-0 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
              <Table className="w-full table-fixed text-xs md:text-sm">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="h-9 w-[30%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("checkouts.columns.checkout")}</TableHead>
                    <TableHead className="h-9 w-[25%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("checkouts.columns.product")}</TableHead>
                    <TableHead className="h-9 w-[10%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("checkouts.columns.status")}</TableHead>
                    <TableHead className="h-9 w-[8%] bg-card px-3 text-center text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">
                      {t("checkouts.columns.orders")}
                    </TableHead>
                    <TableHead className="h-9 w-[20%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("checkouts.columns.creation")}</TableHead>
                    <TableHead className="h-9 w-[7%] bg-card px-3 md:h-10 md:px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkouts.map((checkout) => (
                    <TableRow
                      key={checkout.id}
                      className="cursor-pointer border-border hover:bg-muted/30"
                      onClick={() => navigate(`/admin/checkouts/${checkout.smart_id}/edit`)}
                    >
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground md:text-sm">
                            {checkout.title || checkout.smart_id}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground md:text-xs">
                            ID: {checkout.smart_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <span className="text-xs text-muted-foreground truncate block md:text-sm">
                          {checkout.product_name}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <Badge variant={STATUS_VARIANTS[checkout.status]} className="text-[10px] md:text-xs">
                          {checkout.status === "draft" && t("checkouts.statusLabels.draft")}
                          {checkout.status === "active" && t("checkouts.statusLabels.active")}
                          {checkout.status === "inactive" && t("checkouts.statusLabels.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-center text-xs text-muted-foreground md:p-4 md:text-sm">
                        {checkout.total_orders}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                          {formatCreatedAt(checkout.created_at, t)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {checkout.status === "active" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                window.open(getCheckoutUrl(checkout), "_blank")
                              }
                              title={t("checkouts.openCheckout")}
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                          )}
                          <ActionsMenu
                            items={[
                              { label: t("common.edit"), onClick: () => navigate(`/admin/checkouts/${checkout.smart_id}/edit`) },
                              { label: t("checkouts.actions.copyUrl"), onClick: () => handleCopyUrl(checkout) },
                              {
                                label: checkout.status === "active" ? t("checkouts.actions.deactivate") : t("checkouts.actions.activate"),
                                onClick: () => handleToggleStatus(checkout),
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </Card>
        )}
        </div>
      </div>
  );
}
