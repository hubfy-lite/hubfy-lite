import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { X, Loader2, Upload, ImageIcon, Trash2, AlertTriangle, LaptopMinimal, Smartphone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCheckouts } from "@/hooks/useCheckouts";
import { ButtonGroup } from "@/components/ui/button-group";
import BrowserChrome from "@/components/admin/BrowserChrome";
import CheckoutPreview from "@/components/admin/checkout-edit/CheckoutPreview";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength, limitOptionalNameLength } from "@/lib/name-limits";
import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";
import { CoverCropDialog } from "@/components/admin/CoverCropDialog";
import { isUnsplashConfigured } from "@/lib/unsplash";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

/* ─── Types ─── */

interface PriceOption {
  id: string;
  unit_amount: number;
  currency: string;
  category: string;
}

interface ProductOption {
  id: string;
  public_id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  updated_at?: string;
  prices: PriceOption[];
}

function formatPrice(unitPrice: number, currency: string, freeLabel: string): string {
  if (unitPrice === 0) return freeLabel;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(unitPrice / 100);
}

/* ─── Main Page Component ─── */

export default function AdminCheckoutEdit() {
  const { smartId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const isEdit = !!smartId;
  const { tenant } = useTenant();
  const { createCheckout, updateCheckout } = useCheckouts();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: "payment", label: t("checkoutEdit.tabs.payment") },
    { id: "after", label: t("checkoutEdit.tabs.after") },
  ];

  const [activeTab, setActiveTab] = useState<Tab>("payment");

  // Form state
  const [productId, setProductId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [collectPhone, setCollectPhone] = useState(false);
  const [collectAddress, setCollectAddress] = useState(false);
  const [collectFiscalId, setCollectFiscalId] = useState(false);
  const [allowDiscountCodes, setAllowDiscountCodes] = useState(false);
  const [successUrl, setSuccessUrl] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // ─── Fetch checkout by smart_id (edit mode) ───
  const { data: checkout, isLoading: checkoutLoading } = useQuery({
    queryKey: ["checkout", smartId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("*, products!checkouts_product_id_fkey(name, cover_url, updated_at), prices!checkouts_price_id_fkey(unit_amount, currency)")
        .eq("smart_id", smartId!)
        .single();
      if (error) throw error;
      const row = data as typeof data & {
        products: { name: string; cover_url: string | null; updated_at: string } | null;
        prices: { unit_amount: number; currency: string } | null;
      };
      return {
        id: data.id,
        product_id: data.product_id,
        price_id: data.price_id,
        smart_id: data.smart_id,
        title: limitOptionalNameLength(data.title),
        description: data.description,
        cover_url: data.cover_url,
        collect_phone: data.collect_phone,
        collect_address: data.collect_address,
        collect_fiscal_id: data.collect_fiscal_id,
        allow_discount_codes: data.allow_discount_codes,
        success_url: data.success_url,
        confirmation_message: data.confirmation_message,
        status: data.status,
        unit_amount: row.prices?.unit_amount ?? 0,
        currency: row.prices?.currency ?? "BRL",
        product_name: row.products?.name ? limitNameLength(row.products.name) : "",
        product_cover_url: row.products?.cover_url ?? null,
        product_updated_at: row.products?.updated_at ?? null,
        total_orders: data.total_orders ?? 0,
      };
    },
    enabled: isEdit && !!smartId,
  });

  // ─── Fetch products (for product/price selectors) ───
  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ["products-for-checkout", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, public_id, name, description, cover_url, updated_at, prices(id, unit_amount, currency, category, is_active)")
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      type RawPrice = { id: string; unit_amount: number; currency: string; category: string; is_active: boolean };
      type RawProduct = { id: string; public_id: string; name: string; description: string | null; cover_url: string | null; updated_at: string; prices: RawPrice[] };
      return ((data ?? []) as RawProduct[]).map((p) => ({
        id: p.id,
        public_id: p.public_id,
        name: limitNameLength(p.name),
        description: p.description ?? null,
        cover_url: p.cover_url ?? null,
        updated_at: p.updated_at,
        prices: (p.prices ?? [])
          .filter((pr) => pr.is_active)
          .map((pr) => ({
            id: pr.id,
            unit_amount: pr.unit_amount,
            currency: pr.currency,
            category: pr.category,
          })),
      }));
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });

  // ─── Populate form from fetched checkout (once) ───
  useEffect(() => {
    if (!checkout || hasInitialized.current) return;
    hasInitialized.current = true;
    setProductId(checkout.product_id);
    setPriceId(checkout.price_id);
    setTitle(checkout.title ? limitNameLength(checkout.title) : "");
    setDescription(checkout.description ?? "");
    setCoverUrl(checkout.cover_url ?? "");
    setCollectPhone(checkout.collect_phone);
    setCollectAddress(checkout.collect_address);
    setCollectFiscalId(checkout.collect_fiscal_id);
    setAllowDiscountCodes(checkout.allow_discount_codes);
    setSuccessUrl(checkout.success_url ?? "");
    setConfirmationMessage(checkout.confirmation_message ?? "");
  }, [checkout]);

  // ─── Handle checkout not found ───
  useEffect(() => {
    if (isEdit && !checkoutLoading && !checkout && smartId) {
      toast.error(t("checkoutEdit.notFound"));
      navigate("/admin/checkouts");
    }
  }, [isEdit, checkoutLoading, checkout, smartId, navigate, t]);

  // ─── Pre-select product from query param (?product=<id>) ───
  const preselectedProductId = searchParams.get("product");
  const hasPreselected = useRef(false);

  useEffect(() => {
    if (isEdit || hasPreselected.current || !preselectedProductId || products.length === 0) return;
    const match = products.find((p) => p.public_id === preselectedProductId);
    if (!match) return;
    hasPreselected.current = true;
    setProductId(match.id);
    setPriceId(match.prices[0]?.id ?? "");
    setTitle(limitNameLength(match.name));
    setCoverUrl(match.cover_url ?? "");
    setDescription(match.description ?? "");
  }, [isEdit, preselectedProductId, products]);

  // Auto-select first price and pre-fill title/cover/description when product changes
  const handleProductChange = (newProductId: string) => {
    setProductId(newProductId);
    const selected = products.find((p) => p.id === newProductId);
    setPriceId(selected?.prices[0]?.id ?? "");
    if (!isEdit && selected) {
      setTitle(limitNameLength(selected.name));
      setCoverUrl(selected.cover_url ?? "");
      setDescription(selected.description ?? "");
    }
  };

  const selectedProductPrices =
    products.find((p) => p.id === productId)?.prices ?? [];

  // Image upload — opens crop dialog first
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("checkoutEdit.invalidImage"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("checkoutEdit.imageTooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUnsplashSelect = useCallback(async (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob);
    setCropImageSrc(objectUrl);
    setCropDialogOpen(true);
  }, []);

  // Upload cropped blob to storage
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropDialogOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc("");
    }

    setUploading(true);
    try {
      const id = checkout?.id ?? crypto.randomUUID();
      const fileName = `checkouts/${tenant?.id}/${id}_cover.webp`;
      const { error } = await supabase.storage
        .from("covers")
        .upload(fileName, blob, { upsert: true, contentType: "image/webp" });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("covers").getPublicUrl(fileName);
      setCoverUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("checkoutEdit.imageUploadError")));
    } finally {
      setUploading(false);
    }
  }, [checkout?.id, tenant?.id, t, cropImageSrc]);

  // Save
  const handleSave = async () => {
    if (!isEdit && !productId) {
      toast.error(t("checkoutEdit.selectProduct"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit && checkout) {
        await updateCheckout(checkout.id, {
          title: title.trim() || null,
          description: description.trim() || null,
          cover_url: coverUrl.trim() || null,
          collect_phone: collectPhone,
          collect_address: collectAddress,
          collect_fiscal_id: collectFiscalId,
          allow_discount_codes: allowDiscountCodes,
          success_url: successUrl.trim() || null,
          confirmation_message: confirmationMessage.trim() || null,
        });
        toast.success(t("checkoutEdit.updated"));
      } else {
        if (!priceId) {
          toast.error(t("checkoutEdit.selectPrice"));
          return;
        }

        await createCheckout({
          product_id: productId,
          price_id: priceId,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
          collect_phone: collectPhone,
          collect_address: collectAddress,
          collect_fiscal_id: collectFiscalId,
          allow_discount_codes: allowDiscountCodes,
          success_url: successUrl.trim() || undefined,
          confirmation_message: confirmationMessage.trim() || undefined,
        });
        toast.success(t("checkoutEdit.created"));
      }
      navigate("/admin/checkouts");
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("checkoutEdit.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => navigate("/admin/checkouts");

  // Preview data
  const selectedProduct = products.find((p) => p.id === productId);
  const selectedPrice = selectedProduct?.prices.find(
    (pr) => pr.id === priceId
  );

  const previewProductName =
    selectedProduct?.name ?? checkout?.product_name ?? "";
  const previewUnitAmount =
    selectedPrice?.unit_amount ?? checkout?.unit_amount ?? 0;
  const previewCurrency =
    selectedPrice?.currency ?? checkout?.currency ?? "BRL";
  const previewPriceCategory = selectedPrice?.category ?? null;
  const previewProductCoverUrl =
    selectedProduct?.cover_url
      ? getCoversOptimizedUrl(
          selectedProduct.cover_url,
          "product-card",
          selectedProduct.updated_at
        ) || selectedProduct.cover_url
      : checkout?.product_cover_url
        ? getCoversOptimizedUrl(
            checkout.product_cover_url,
            "product-card",
            checkout.product_updated_at
          ) || checkout.product_cover_url
        : null;
  const coverFieldPreviewUrl = coverUrl
    ? getCoversOptimizedUrl(
        coverUrl,
        "product-card",
        selectedProduct?.updated_at ?? checkout?.product_updated_at
      ) || coverUrl
    : "";

  const hasProduct = isEdit || !!productId;

  // Loading state for edit mode
  if (isEdit && checkoutLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">{t("checkoutEdit.loadingCheckout")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col min-h-0 bg-card">
        {/* ─── Header with tabs ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goBack}
            >
              <X className="size-4" />
            </Button>
            <span className="text-base font-semibold text-foreground">
              {isEdit ? t("checkoutEdit.editTitle") : t("checkoutEdit.createTitle")}
            </span>
          </div>

          <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="w-[140px]" />
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Config panel */}
          <div className="w-full lg:w-[420px] shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border p-6 order-1">
            {activeTab === "payment" ? (
              <PaymentTabContent
                isEdit={isEdit}
                products={products}
                productId={productId}
                priceId={priceId}
                selectedProductPrices={selectedProductPrices}
                title={title}
                description={description}
                coverUrl={coverUrl}
                coverPreviewUrl={coverFieldPreviewUrl}
                collectPhone={collectPhone}
                collectAddress={collectAddress}
                collectFiscalId={collectFiscalId}
                allowDiscountCodes={allowDiscountCodes}
                uploading={uploading}
                fileInputRef={fileInputRef}
                onProductChange={handleProductChange}
                onPriceChange={setPriceId}
                onTitleChange={(value) => setTitle(limitNameLength(value))}
                onDescriptionChange={setDescription}
                onCoverUrlChange={setCoverUrl}
                onCollectPhoneChange={setCollectPhone}
                onCollectAddressChange={setCollectAddress}
                onCollectFiscalIdChange={setCollectFiscalId}
                onAllowDiscountCodesChange={setAllowDiscountCodes}
                onImageSelect={handleImageSelect}
                unsplashOpen={unsplashOpen}
                onUnsplashOpenChange={setUnsplashOpen}
                onUnsplashSelect={handleUnsplashSelect}
                cropDialogOpen={cropDialogOpen}
                onCropDialogOpenChange={(open) => {
                  setCropDialogOpen(open);
                  if (!open && cropImageSrc) {
                    URL.revokeObjectURL(cropImageSrc);
                    setCropImageSrc("");
                  }
                }}
                cropImageSrc={cropImageSrc}
                onCropConfirm={handleCropConfirm}
              />
            ) : (
              <AfterPaymentTabContent
                confirmationMessage={confirmationMessage}
                successUrl={successUrl}
                onConfirmationMessageChange={setConfirmationMessage}
                onSuccessUrlChange={setSuccessUrl}
              />
            )}
          </div>

          {/* RIGHT: Preview */}
          <div className="hidden lg:flex flex-1 min-w-0 p-6 order-2 flex-col items-center">
            {/* Desktop / Mobile toggle */}
            {hasProduct && (
              <div className="flex justify-center mb-4 shrink-0">
                <ButtonGroup>
                  <Button
                    variant={previewMode === "desktop" ? "default" : "outline"}
                    size="icon-sm"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <LaptopMinimal className="size-3.5" />
                  </Button>
                  <Button
                    variant={previewMode === "mobile" ? "default" : "outline"}
                    size="icon-sm"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="size-3.5" />
                  </Button>
                </ButtonGroup>
              </div>
            )}

            <div className="flex-1 min-h-0 flex items-center justify-center w-full">
              {hasProduct ? (
                <div
                  className="h-full"
                  style={{
                    width: previewMode === "desktop" ? "min(100%, 820px)" : "360px",
                    maxHeight: "100%",
                    transition: "width 550ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <BrowserChrome
                    url={`seusite.com/checkout/${checkout?.smart_id ?? "preview"}`}
                  >
                    <div className="h-full overflow-y-auto">
                      <CheckoutPreview
                        productName={previewProductName}
                        unitAmount={previewUnitAmount}
                        currency={previewCurrency}
                        priceCategory={previewPriceCategory}
                        title={title}
                        description={description}
                        coverUrl={coverUrl}
                        productCoverUrl={previewProductCoverUrl}
                        collectPhone={collectPhone}
                        collectAddress={collectAddress}
                        collectFiscalId={collectFiscalId}
                        allowDiscountCodes={allowDiscountCodes}
                        tenantName={tenant?.name ?? ""}
                        tenantIconUrl={tenant?.icon_url ?? null}
                        brandColor={tenant?.primary_color ?? "#6366f1"}
                        bgColor={
                          tenant?.checkout_use_brand_colors !== false
                            ? (tenant?.theme_mode === "dark" ? "#0A0A0A" : "#F9F9F9")
                            : tenant?.checkout_bg_color || undefined
                        }
                        buttonColor={
                          tenant?.checkout_use_brand_colors !== false
                            ? undefined
                            : tenant?.checkout_button_color || undefined
                        }
                        buttonStyle={tenant?.checkout_button_style}
                        fontFamily={tenant?.checkout_font_family}
                        previewMode={previewMode}
                      />
                    </div>
                  </BrowserChrome>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 h-full">
                  <p className="text-sm text-muted-foreground">
                    {t("checkoutEdit.selectProductPreview")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t border-border shrink-0 bg-card">
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? t("common.save") : t("checkoutEdit.createTitle")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tabs ─── */

type Tab = "payment" | "after";

/* ─── Tab: Payment page ─── */

interface PaymentTabContentProps {
  isEdit: boolean;
  products: ProductOption[];
  productId: string;
  priceId: string;
  selectedProductPrices: PriceOption[];
  title: string;
  description: string;
  coverUrl: string;
  coverPreviewUrl: string;
  collectPhone: boolean;
  collectAddress: boolean;
  collectFiscalId: boolean;
  allowDiscountCodes: boolean;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onProductChange: (id: string) => void;
  onPriceChange: (id: string) => void;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCoverUrlChange: (v: string) => void;
  onCollectPhoneChange: (v: boolean) => void;
  onCollectAddressChange: (v: boolean) => void;
  onCollectFiscalIdChange: (v: boolean) => void;
  onAllowDiscountCodesChange: (v: boolean) => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  unsplashOpen: boolean;
  onUnsplashOpenChange: (open: boolean) => void;
  onUnsplashSelect: (blob: Blob) => void;
  cropDialogOpen: boolean;
  onCropDialogOpenChange: (open: boolean) => void;
  cropImageSrc: string;
  onCropConfirm: (blob: Blob) => void;
}

function PaymentTabContent({
  isEdit,
  products,
  productId,
  priceId,
  selectedProductPrices,
  title,
  description,
  coverUrl,
  coverPreviewUrl,
  collectPhone,
  collectAddress,
  collectFiscalId,
  allowDiscountCodes,
  uploading,
  fileInputRef,
  onProductChange,
  onPriceChange,
  onTitleChange,
  onDescriptionChange,
  onCoverUrlChange,
  onCollectPhoneChange,
  onCollectAddressChange,
  onCollectFiscalIdChange,
  onAllowDiscountCodesChange,
  onImageSelect,
  unsplashOpen,
  onUnsplashOpenChange,
  onUnsplashSelect,
  cropDialogOpen,
  onCropDialogOpenChange,
  cropImageSrc,
  onCropConfirm,
}: PaymentTabContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* ─── Card: General ─── */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("checkoutEdit.general")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product (create only) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>{t("checkoutEdit.productLabel")}</Label>
              <Select value={productId} onValueChange={onProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("checkoutEdit.productPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.cover_url ? (
                          <img
                            src={
                              getCoversOptimizedUrl(
                                p.cover_url,
                                "product-thumb",
                                p.updated_at
                              ) || p.cover_url
                            }
                            alt=""
                            className="size-6 rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="size-6 rounded bg-muted flex items-center justify-center shrink-0">
                            <ImageIcon className="size-3 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate">{p.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Price (create only) */}
          {!isEdit && productId && (
            <div className="space-y-2">
              <Label>{t("checkoutEdit.priceLabel")}</Label>
              {selectedProductPrices.length === 0 ? (
                <p className="text-sm text-destructive">
                  {t("checkoutEdit.noPrices")}
                </p>
              ) : (
                <Select value={priceId} onValueChange={onPriceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("checkoutEdit.pricePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProductPrices.map((price) => (
                      <SelectItem key={price.id} value={price.id}>
                        {formatPrice(price.unit_amount, price.currency, t("checkoutEdit.free"))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="checkout-title">{t("checkoutEdit.titleLabel")}</Label>
            <Input
              id="checkout-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={t("checkoutEdit.titlePlaceholder")}
              maxLength={FRONTEND_NAME_MAX_LENGTH}
            />
            <p className="text-xs text-muted-foreground">
              {t("checkoutEdit.titleHint")}
            </p>
          </div>

          {/* Cover image */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">{t("checkoutEdit.imageLabel")}</p>
              <p className="text-xs text-muted-foreground">
                {t("checkoutEdit.imageHint")}
              </p>
            </div>

            <div
              className="relative w-full aspect-square rounded-xl bg-muted border border-border flex items-center justify-center cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {coverUrl ? (
                <>
                  <img
                    src={coverPreviewUrl}
                    alt={t("checkoutEdit.imageAlt")}
                    className="size-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <Upload className="size-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="size-6" />
                      <span className="text-xs">{t("checkoutEdit.imageClickToUpload")}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {coverUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onCoverUrlChange("")}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  {t("checkoutEdit.imageRemove")}
                </Button>
              )}

              {isUnsplashConfigured() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUnsplashOpenChange(true)}
                >
                  <Search className="size-3.5 mr-1.5" />
                  {t("unsplash.searchButton")}
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onImageSelect}
              className="hidden"
            />

            <UnsplashPickerDialog
              open={unsplashOpen}
              onOpenChange={onUnsplashOpenChange}
              onSelect={(blob) => onUnsplashSelect(blob)}
            />

            <CoverCropDialog
              open={cropDialogOpen}
              onOpenChange={onCropDialogOpenChange}
              imageSrc={cropImageSrc}
              onConfirm={onCropConfirm}
              aspect={1}
              targetWidth={800}
              targetHeight={800}
              dialogDescription="Ajuste a área de recorte para o formato quadrado 1:1"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="checkout-description">{t("checkoutEdit.descriptionLabel")}</Label>
            <Textarea
              {...NO_AUTOFILL_PROPS}
              id="checkout-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder={t("checkoutEdit.descriptionPlaceholder")}
              rows={3}
            />
          </div>

          {/* Capture fields */}
          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("checkoutEdit.captureHint")}
            </p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("checkoutEdit.phoneLabel")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("checkoutEdit.phoneDescription")}
                </p>
              </div>
              <Switch
                checked={collectPhone}
                onCheckedChange={onCollectPhoneChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("checkoutEdit.addressLabel")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("checkoutEdit.addressDescription")}
                </p>
              </div>
              <Switch
                checked={collectAddress}
                onCheckedChange={onCollectAddressChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Card: Advanced ─── */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("checkoutEdit.advanced")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("checkoutEdit.fiscalIdLabel")}</p>
              <p className="text-xs text-muted-foreground">
                {t("checkoutEdit.fiscalIdDescription")}
              </p>
            </div>
            <Switch
              checked={collectFiscalId}
              onCheckedChange={onCollectFiscalIdChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("checkoutEdit.discountLabel")}</p>
              <p className="text-xs text-muted-foreground">
                {t("checkoutEdit.discountDescription")}
              </p>
            </div>
            <Switch
              checked={allowDiscountCodes}
              onCheckedChange={onAllowDiscountCodesChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Tab: After payment ─── */

interface AfterPaymentTabContentProps {
  confirmationMessage: string;
  successUrl: string;
  onConfirmationMessageChange: (v: string) => void;
  onSuccessUrlChange: (v: string) => void;
}

function AfterPaymentTabContent({
  confirmationMessage,
  successUrl,
  onConfirmationMessageChange,
  onSuccessUrlChange,
}: AfterPaymentTabContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("checkoutEdit.general")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checkout-confirmation">{t("checkoutEdit.confirmationLabel")}</Label>
            <Textarea
              {...NO_AUTOFILL_PROPS}
              id="checkout-confirmation"
              value={confirmationMessage}
              onChange={(e) => onConfirmationMessageChange(e.target.value)}
              placeholder={t("checkoutEdit.confirmationPlaceholder")}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t("checkoutEdit.confirmationHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkout-success-url">{t("checkoutEdit.successUrlLabel")}</Label>
            <Input
              id="checkout-success-url"
              value={successUrl}
              onChange={(e) => onSuccessUrlChange(e.target.value)}
              placeholder={t("checkoutEdit.successUrlPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("checkoutEdit.successUrlHint")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
