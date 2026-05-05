import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Upload,
  UserCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import { TableSkeleton } from "@/components/admin/TableSkeleton";
import CustomerSheet from "@/components/admin/CustomerSheet";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useCustomers, type Customer } from "@/hooks/useCustomers";

export default function AdminCustomers() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const {
    customers,
    loading,
    addCustomer,
    updateCustomer,
    removeCustomer,
  } = useCustomers(debouncedSearch);

  // URL-driven edit: ?id= selects customer for sheet
  const selectedCustomerId = searchParams.get("id");
  const selectedCustomer = customers.find((c) => c.public_id === selectedCustomerId) ?? null;
  const editSheetOpen = !!selectedCustomerId;

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Handlers ──

  const handleOpenCreate = () => {
    // Close any edit first, then open create
    if (selectedCustomerId) {
      const next = new URLSearchParams(searchParams);
      next.delete("id");
      setSearchParams(next, { replace: true });
    }
    setCreateOpen(true);
  };

  const handleOpenEdit = (customerId: string) => {
    // Close create if open, set id in URL
    setCreateOpen(false);
    const next = new URLSearchParams(searchParams);
    next.set("id", customerId);
    setSearchParams(next);
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      // Edit sheet closing: remove id from URL
      if (selectedCustomerId) {
        const next = new URLSearchParams(searchParams);
        next.delete("id");
        setSearchParams(next, { replace: true });
      }
      // Create sheet closing
      setCreateOpen(false);
      // Fix pointer-events Radix bug
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = "";
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeCustomer(deleteTarget.user_id);
      toast.success(t("customers.actions.removed"));
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("customers.actions.removeError")));
    } finally {
      setDeleteTarget(null);
    }
  };

  // Determine sheet state
  const sheetOpen = createOpen || editSheetOpen;
  const sheetCustomer = createOpen ? null : selectedCustomer;

  return (
    <>
      <div className="min-w-0 p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
          <div className="flex min-w-0 shrink-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal text-foreground md:text-2xl">
                {t("customers.title")}
              </h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
                  onClick={() => navigate("/admin/customers/import")}
                >
                  <Upload className="size-3.5 md:size-4" />
                  <span className="hidden md:inline">{t("customers.importCsv")}</span>
                </Button>
                <Button
                  onClick={handleOpenCreate}
                  size="sm"
                  className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
                >
                  <Plus className="size-3.5 md:size-4" />
                  <span className="md:hidden">Add</span>
                  <span className="hidden md:inline">{t("customers.addCustomer")}</span>
                </Button>
              </div>
            </div>

            <div className="min-w-0 w-full">
              <div className="relative w-full min-w-0 max-w-none sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
                <Input
                  placeholder={t("customers.searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 pl-8 text-sm md:h-10 md:pl-9"
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            {loading ? (
              <div className="h-full min-w-0 overflow-auto">
                <TableSkeleton rows={5} columns={6} />
              </div>
            ) : customers.length === 0 && !debouncedSearch ? (
              <div className="h-full min-w-0 overflow-auto">
                <Card variant="bordered">
                  <CardContent className="py-12 sm:py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 sm:size-16">
                        <UserCircle className="size-7 text-primary sm:size-8" />
                      </div>
                      <h3 className="mb-2 text-base font-semibold text-foreground sm:text-lg">
                        {t("customers.emptyTitle")}
                      </h3>
                      <p className="mb-6 max-w-sm text-[10px] text-muted-foreground sm:text-xs">
                        {t("customers.emptyDescription")}
                      </p>
                      <Button
                        onClick={handleOpenCreate}
                        size="sm"
                        className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
                      >
                        <Plus className="size-3.5 md:size-4" />
                        <span className="md:hidden">Add</span>
                        <span className="hidden md:inline">{t("customers.addCustomer")}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : customers.length === 0 && debouncedSearch ? (
              <div className="h-full min-w-0 overflow-auto">
                <Card variant="bordered">
                  <CardContent className="py-12 sm:py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted sm:size-16">
                        <Search className="size-7 text-muted-foreground sm:size-8" />
                      </div>
                      <h3 className="mb-2 text-base font-semibold text-foreground sm:text-lg">
                        {t("customers.noResults")}
                      </h3>
                      <p className="max-w-sm text-[10px] text-muted-foreground sm:text-xs">
                        {t("customers.noResultsDescription", { search: debouncedSearch })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card variant="bordered" className="min-w-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                  <Table className="w-full text-xs md:text-sm">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="h-9 bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">
                          {t("customers.columns.customer")}
                        </TableHead>
                        <TableHead className="h-9 bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">
                          {t("customers.columns.phone")}
                        </TableHead>
                        <TableHead className="h-9 bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">
                          {t("customers.columns.country")}
                        </TableHead>
                        <TableHead className="h-9 bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">
                          {t("customers.columns.status")}
                        </TableHead>
                        <TableHead className="h-9 bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">
                          {t("customers.columns.createdAt")}
                        </TableHead>
                        <TableHead className="h-9 w-11 bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:w-12 md:px-4 md:text-xs" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow
                          key={customer.user_id}
                          className="border-border hover:bg-muted/30 cursor-pointer"
                          onClick={() => handleOpenEdit(customer.public_id)}
                        >
                          <TableCell className="px-3 py-2.5 md:p-4">
                            <div className="flex items-center gap-2.5 md:gap-3">
                              <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted md:size-8">
                                {customer.avatar_url ? (
                                  <img
                                    src={customer.avatar_url}
                                    alt={customer.name}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[10px] font-semibold text-muted-foreground md:text-xs">
                                    {customer.name?.charAt(0)?.toUpperCase() || "?"}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-foreground md:text-sm">
                                  {customer.name}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground md:text-xs">
                                  {customer.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="px-3 py-2.5 md:p-4">
                            <span className="text-xs text-foreground md:text-sm">
                              {customer.phone || "—"}
                            </span>
                          </TableCell>

                          <TableCell className="px-3 py-2.5 md:p-4">
                            <span className="text-xs text-foreground md:text-sm">
                              {customer.country || "—"}
                            </span>
                          </TableCell>

                          <TableCell className="px-3 py-2.5 md:p-4">
                            {customer.email_marketing_status === "subscribed" ? (
                              <Badge variant="success" className="text-[10px] md:text-xs">
                                {t("customers.statusLabels.subscribed")}
                              </Badge>
                            ) : customer.email_marketing_status === "unsubscribed" ? (
                              <Badge variant="secondary" className="text-[10px] md:text-xs">
                                {t("customers.statusLabels.unsubscribed")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] md:text-xs">
                                {customer.email_marketing_status}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="px-3 py-2.5 md:p-4">
                            <span className="text-[10px] text-muted-foreground md:text-xs">
                              {formatDateTime(customer.created_at, lang)}
                            </span>
                          </TableCell>

                          <TableCell className="px-3 py-2.5 md:p-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleOpenEdit(customer.public_id)}
                              >
                                <Eye className="size-4" />
                              </Button>
                              <ActionsMenu
                                items={[
                                  { label: t("common.copyId"), onClick: () => { navigator.clipboard.writeText(customer.public_id); toast.success(t("common.idCopied")); } },
                                  { label: t("customers.actions.viewDetails"), onClick: () => navigate(`/admin/customers/${customer.public_id}`) },
                                  { label: t("common.delete"), onClick: () => setDeleteTarget(customer), destructive: true },
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
      </div>

      {/* Customer Sheet (create/edit) — URL-driven for edit, local for create */}
      <CustomerSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        customer={sheetCustomer}
        onAdd={addCustomer}
        onUpdate={updateCustomer}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("customers.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("customers.deleteDialog.description", { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
