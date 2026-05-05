import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  ShoppingBag,
  Loader2,
  List,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { translateAppError } from "@/lib/app-error-utils";

import { TableSkeleton } from "@/components/admin/TableSkeleton";
import ProductSheet from "@/components/admin/ProductSheet";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MultiSelect } from "@/components/ui/multi-select";
import { useProducts, type Product } from "@/hooks/useProducts";
import { useTenant } from "@/hooks/useTenant";
import { buildPublicUrl } from "@/lib/public-site-url";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PortalProductsPreview } from "@/components/admin/PortalProductsPreview";

const ADMIN_IMAGE_PLACEHOLDER = "/images/placeholder.svg";

function formatCreatedAt(iso: string, lang: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  if (lang === "en") return `${month}/${day}/${year} ${hours}:${minutes}`;
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "amber",
  active: "green",
  archived: "gray",
};

export default function AdminProducts() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { tenant } = useTenant();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOrderDirty, setIsOrderDirty] = useState(false);
  const saveOrderRef = useRef<(() => Promise<void>) | null>(null);
  const viewMode = (searchParams.get("view") === "order" ? "order" : "list") as "list" | "order";
  const setViewMode = (mode: "list" | "order") => {
    setSearchParams((prev) => {
      if (mode === "list") { prev.delete("view"); } else { prev.set("view", mode); }
      return prev;
    }, { replace: true });
  };

  // Fix: Radix Dialog can leave pointer-events:none on body when closed with nested Radix components
  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = "";
      });
    }
  };

  const {
    products,
    loading,
    actionLoading,
    createProduct,
    updateProduct,
    setProductDeliverable,
    reorderProducts,
    deleteProduct,
  } = useProducts(debouncedSearch, statusFilter as import("@/integrations/supabase/types").Database["public"]["Enums"]["product_status"][]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleOpenCreate = () => {
    setEditProduct(null);
    handleSheetOpenChange(true);
  };

  const handleOpenEdit = (product: Product) => {
    navigate(`/admin/products/${product.public_id}`);
  };

  const handleOpenLogin = () => {
    if (!tenant?.slug) return;
    window.open(buildPublicUrl(`/${tenant.slug}/login`), "_blank", "noopener,noreferrer");
  };

  const handleSetStatus = async (product: Product, newStatus: "draft" | "active" | "archived") => {
    // Guardrail: validação parcial — se benefit definido, exigir conteúdo vinculado
    if (newStatus === "active") {
      if (product.benefit === "courses" && product.courses_count === 0) {
        toast.error(t("products.actions.activateNoCourses"));
        return;
      }
      if (product.benefit === "files" && product.assets_count === 0) {
        toast.error(t("products.actions.activateNoFiles"));
        return;
      }
      if (product.benefit === "links" && product.links_count === 0) {
        toast.error(t("products.actions.activateNoLinks"));
        return;
      }
    }

    try {
      await updateProduct(product.id, { status: newStatus });
      const toastMessages: Record<string, string> = {
        active: t("products.actions.productActivated"),
        draft: t("products.actions.productBackToDraft"),
        archived: t("products.actions.productArchived"),
      };
      toast.success(toastMessages[newStatus]);
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("products.actions.statusError")));
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      draft: t("products.statusLabels.draft"),
      active: t("products.statusLabels.active"),
      archived: t("products.statusLabels.archived"),
    };
    return labels[status] ?? status;
  };

  return (
    <>
      <div className="min-w-0 p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
        {/* Header */}
        <div className="flex min-w-0 shrink-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal text-foreground md:text-2xl">
              {t("products.title")}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {tenant?.slug && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
                  onClick={() => window.open(buildPublicUrl(`/${tenant.slug}`), "_blank", "noopener,noreferrer")}
                >
                  <Eye className="size-3.5 md:size-4" />
                  <span>{t("products.portalPreview.portalButton")}</span>
                </Button>
              )}
              {viewMode === "order" ? (
                <Button
                  onClick={() => saveOrderRef.current?.()}
                  disabled={!isOrderDirty}
                  size="sm"
                  className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
                >
                  <span>{t("products.portalPreview.save")}</span>
                </Button>
              ) : (
                <Button
                  onClick={handleOpenCreate}
                  size="sm"
                  className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
                >
                  <Plus className="size-3.5 md:size-4" />
                  <span className="md:hidden">Add</span>
                  <span className="hidden md:inline">{t("products.newProduct")}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1 max-w-none sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
              <Input
                placeholder={t("products.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-8 text-sm md:h-10 md:pl-9"
              />
            </div>
            <MultiSelect
              options={[
                { value: "draft", label: t("products.filterDraft") },
                { value: "active", label: t("products.filterActive") },
                { value: "archived", label: t("products.filterArchived") },
              ]}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder={t("products.filterAll")}
              className="h-9 w-full sm:w-[180px] md:h-10"
            />
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => { if (v) setViewMode(v as "list" | "order"); }}
              variant="outline"
              size="sm"
              className="hidden md:flex"
            >
              <ToggleGroupItem value="list" className="gap-1.5 px-3 text-xs md:text-sm">
                <List className="size-3.5" />
                {t("products.viewList")}
              </ToggleGroupItem>
              <ToggleGroupItem value="order" className="gap-1.5 px-3 text-xs md:text-sm">
                <ArrowUpDown className="size-3.5" />
                {t("products.viewOrder")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : products.length === 0 ? (
          <Card variant="bordered">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ShoppingBag className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("products.emptyTitle")}
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                {t("products.emptyDescription")}
              </p>
              <Button onClick={handleOpenCreate}>
                <Plus className="size-4" />
                {t("products.createFirst")}
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "order" ? (
          <PortalProductsPreview
            products={products}
            onReorder={reorderProducts}
            onDirtyChange={setIsOrderDirty}
            saveRef={saveOrderRef}
          />
        ) : (
          <Card variant="bordered" className="min-w-0 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
              <Table className="w-full table-fixed text-xs md:text-sm">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="h-9 bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("products.columns.product")}</TableHead>
                    <TableHead className="h-9 w-[100px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("products.columns.deliverable")}</TableHead>
                    <TableHead className="h-9 w-[130px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("products.columns.creation")}</TableHead>
                    <TableHead className="h-9 w-[80px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("products.columns.orders")}</TableHead>
                    <TableHead className="h-9 w-[120px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("products.columns.status")}</TableHead>
                    <TableHead className="h-9 w-[72px] bg-card px-3 md:h-10 md:px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const thumb = product.cover_url
                      ? getCoversOptimizedUrl(product.cover_url, "product-thumb", product.updated_at)
                      : null;
                    return (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer border-border hover:bg-muted/30"
                      onClick={() => handleOpenEdit(product)}
                    >
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <div className="flex items-center gap-2.5 md:gap-3">
                          <div className="size-16 rounded-xl bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center md:size-20">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="size-full object-cover rounded-xl"
                                loading="lazy"
                              />
                            ) : (
                              <img
                                src={ADMIN_IMAGE_PLACEHOLDER}
                                alt=""
                                className="size-full object-cover rounded-xl opacity-70"
                                loading="lazy"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground md:text-sm">
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="truncate text-[10px] text-muted-foreground md:text-xs">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        {product.benefit === "courses" ? (
                          <Badge variant="blue" className="text-[10px] md:text-xs">
                            {t("products.deliverableTypes.course")}
                          </Badge>
                        ) : product.benefit === "files" ? (
                          <Badge variant="purple" className="text-[10px] md:text-xs">
                            {t("products.deliverableTypes.file")}
                          </Badge>
                        ) : product.benefit === "links" ? (
                          <Badge variant="green" className="text-[10px] md:text-xs">
                            {t("products.deliverableTypes.link")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                          {formatCreatedAt(product.created_at, i18n.language)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <span className="text-xs font-medium text-foreground md:text-sm">
                          {product.orders_count}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <Badge variant={STATUS_VARIANTS[product.status]} className="text-[10px] md:text-xs">
                          {getStatusLabel(product.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <ActionsMenu
                            items={[
                              { label: t("common.edit"), onClick: () => handleOpenEdit(product) },
                              {
                                label: t("products.actions.copyProductId"),
                                onClick: () => {
                                  navigator.clipboard.writeText(product.public_id);
                                  toast.success(t("common.idCopied"));
                                },
                              },
                              ...(product.status === "draft" ? [
                                { label: t("products.actions.activate"), onClick: () => handleSetStatus(product, "active") },
                              ] : product.status === "active" ? [
                                { label: t("products.actions.backToDraft"), onClick: () => handleSetStatus(product, "draft") },
                                { label: t("products.actions.archive"), onClick: () => handleSetStatus(product, "archived") },
                              ] : [
                                { label: t("products.actions.backToDraft"), onClick: () => handleSetStatus(product, "draft") },
                              ]),
                              {
                                label: t("products.actions.delete"),
                                onClick: () => setDeleteTarget(product),
                                destructive: true,
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </Card>
        )}
      </div>

      </div>

      {/* Sheets & Dialogs */}
      <ProductSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        product={editProduct}
        onAdd={createProduct}
        onUpdate={updateProduct}
        onSetDeliverable={setProductDeliverable}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.actions.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t("products.actions.deleteConfirmDescription")}</p>
                <p
                  className="text-sm text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: t("products.actions.deleteConfirmInstruction", {
                      word: t("products.actions.deleteConfirmWord"),
                    }),
                  }}
                />
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={t("products.actions.deleteConfirmWord")}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={actionLoading || deleteConfirmText !== t("products.actions.deleteConfirmWord")}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                try {
                  await deleteProduct(deleteTarget.id);
                  toast.success(t("products.actions.productDeleted"));
                  setDeleteTarget(null);
                  setDeleteConfirmText("");
                } catch (error: unknown) {
                  toast.error(translateAppError(error, t("products.actions.deleteError")));
                }
              }}
            >
              {actionLoading && <Loader2 className="size-4 animate-spin" />}
              {t("products.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
