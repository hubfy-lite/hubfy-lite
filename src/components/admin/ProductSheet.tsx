import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { translateAppError } from "@/lib/app-error-utils";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import {
  Loader2,
  Upload,
  ImageIcon,
  Trash2,
  ChevronDown,
  Copy,
  Lock,
  Search,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";
import { CoverCropDialog } from "@/components/admin/CoverCropDialog";
import { isUnsplashConfigured } from "@/lib/unsplash";
import { cleanCoverValue, getCoversPublicUrl } from "@/lib/storage-urls";
import type {
  Product,
  CreateProductData,
  UpdateProductData,
  SetProductDeliverableData,
  BenefitType,
} from "@/hooks/useProducts";
import {
  ProductAssetSelectionList,
  ProductBenefitTypeCards,
  ProductCourseSelectionList,
  ProductLinkInputList,
  type DeliverableAssetOption,
  type DeliverableCourseOption,
} from "@/components/admin/ProductDeliverableFields";
import type { LinkItem } from "@/hooks/useProducts";
import { useInlineAssetUpload } from "@/hooks/useInlineAssetUpload";

/* ─── Types for fetched data ─── */
type AssetOption = DeliverableAssetOption;
type CourseOption = DeliverableCourseOption;

/* ─── Props ─── */
interface ProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onAdd: (data: CreateProductData) => Promise<unknown>;
  onUpdate: (productId: string, data: UpdateProductData) => Promise<void>;
  onSetDeliverable?: (
    productId: string,
    data: SetProductDeliverableData
  ) => Promise<void>;
}

/* ─── Simple collapsible section (no Radix, no overflow-hidden) ─── */
function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center justify-between py-3.5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {title}
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && <div className="pb-4 space-y-4">{children}</div>}
    </div>
  );
}

export default function ProductSheet({
  open,
  onOpenChange,
  product,
  onAdd,
  onUpdate,
  onSetDeliverable,
}: ProductSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!product;
  const { tenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

  // Deliverable state
  const [benefitType, setBenefitType] = useState<BenefitType | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);

  // Options loaded from DB
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");

  // Inline asset upload
  const inlineUpload = useInlineAssetUpload({
    assets,
    setAssets,
    selectedAssetIds,
    setSelectedAssetIds,
    tenantId: tenant?.id,
  });

  // Fetch assets & courses when sheet opens
  const fetchOptions = useCallback(async () => {
    if (!tenant?.id) return;
    setLoadingOptions(true);
    try {
      const [assetsRes, coursesRes] = await Promise.all([
        supabase
          .from("assets")
          .select("id, title, mime_type, size_bytes")
          .eq("tenant_id", tenant.id)
          .neq("type", "video")
          .eq("status", "ready")
          .order("title"),
        supabase
          .from("courses")
          .select("id, title, category")
          .eq("tenant_id", tenant.id)
          .order("title"),
      ]);

      setAssets(assetsRes.data ?? []);
      setCourses(
        (coursesRes.data ?? []).map((course) => ({
          ...course,
          title: limitNameLength(course.title),
        }))
      );
    } catch {
      // silent
    } finally {
      setLoadingOptions(false);
    }
  }, [tenant?.id]);

  // Fetch existing links for edit mode
  const fetchExistingLinks = useCallback(async () => {
    if (!product?.id) return;
    try {
      const [assetsRes, coursesRes, linksRes] = await Promise.all([
        supabase
          .from("product_assets")
          .select("asset_id")
          .eq("product_id", product.id)
          .order("sort_order"),
        supabase
          .from("product_courses")
          .select("course_id")
          .eq("product_id", product.id),
        supabase
          .from("product_links")
          .select("url, title, description")
          .eq("product_id", product.id)
          .order("sort_order"),
      ]);

      setSelectedAssetIds(assetsRes.data?.map((r) => r.asset_id) ?? []);
      setSelectedCourseIds(coursesRes.data?.map((r) => r.course_id) ?? []);
      setLinkItems(
        (linksRes.data ?? []).map((r) => ({
          url: r.url,
          title: r.title,
          description: r.description ?? undefined,
        }))
      );
    } catch {
      // silent
    }
  }, [product?.id]);

  // Reset form when sheet opens/closes or product changes
  useEffect(() => {
    if (!open) return;
    fetchOptions();

    if (product) {
      const cleanCoverUrl = cleanCoverValue(product.cover_url);
      setName(product.name);
      setDescription(product.description ?? "");
      setCoverUrl(cleanCoverUrl);
      setCoverPreviewUrl(
        cleanCoverUrl ? getCoversPublicUrl(cleanCoverUrl, product.updated_at) : ""
      );
      setBenefitType(product.benefit);
      setAssetSearch("");
      fetchExistingLinks();
    } else {
      setName("");
      setDescription("");
      setCoverUrl("");
      setCoverPreviewUrl("");
      setBenefitType(null);
      setSelectedAssetIds([]);
      setSelectedCourseIds([]);
      setLinkItems([]);
      setAssetSearch("");
    }
  }, [product, open, fetchOptions, fetchExistingLinks]);

  const handleNameChange = (value: string) => {
    setName(limitNameLength(value));
  };

  // Image upload — opens crop dialog first
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("productSheet.invalidImage"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("productSheet.maxSize"));
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
      const id = product?.id ?? crypto.randomUUID();
      const fileName = `products/${tenant?.id}/${id}_cover.webp`;
      const { error } = await supabase.storage
        .from("covers")
        .upload(fileName, blob, { upsert: true, contentType: "image/webp" });
      if (error) throw error;

      const nextVersion = Date.now();
      setCoverUrl(fileName);
      setCoverPreviewUrl(getCoversPublicUrl(fileName, nextVersion));
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("productSheet.uploadError")));
    } finally {
      setUploading(false);
    }
  }, [product?.id, tenant?.id, t, cropImageSrc]);

  const handleBenefitTypeChange = (nextBenefit: BenefitType) => {
    setBenefitType(nextBenefit);
    setAssetSearch("");

    if (nextBenefit === "files") {
      setSelectedCourseIds([]);
      setLinkItems([]);
    } else if (nextBenefit === "courses") {
      setSelectedAssetIds([]);
      setLinkItems([]);
    } else {
      setSelectedAssetIds([]);
      setSelectedCourseIds([]);
    }
  };

  const handleSave = async () => {
    // Benefit é opcional — validar conteúdo só se o admin escolheu um tipo
    const needsDeliverableValidation =
      !!benefitType && (!isEdit || (!!product && !product.benefit));

    if (!name.trim()) {
      toast.error(t("productSheet.nameRequired"));
      return;
    }
    if (
      needsDeliverableValidation &&
      benefitType === "files" &&
      selectedAssetIds.length === 0
    ) {
      toast.error(t("productSheet.assetsRequired"));
      return;
    }
    if (
      needsDeliverableValidation &&
      benefitType === "courses" &&
      selectedCourseIds.length === 0
    ) {
      toast.error(t("productSheet.coursesRequired"));
      return;
    }
    if (
      needsDeliverableValidation &&
      benefitType === "links" &&
      linkItems.filter((l) => l.url.trim() && l.title.trim()).length === 0
    ) {
      toast.error(t("productSheet.linksRequired"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await onUpdate(product.id, {
          name: name.trim(),
          description: description.trim() || null,
          cover_url: coverUrl.trim() || null,
        });

        // Update deliverable links
        const benefit = product.benefit ?? benefitType;
        if (benefit && onSetDeliverable) {
          const validLinks = linkItems.filter((l) => l.url.trim() && l.title.trim());
          await onSetDeliverable(product.id, {
            benefit,
            asset_ids: benefit === "files" ? selectedAssetIds : undefined,
            course_ids: benefit === "courses" ? selectedCourseIds : undefined,
            link_items: benefit === "links" ? validLinks : undefined,
          });
        }

        toast.success(t("productSheet.productUpdated"));
      } else {
        const validLinks = linkItems.filter((l) => l.url.trim() && l.title.trim());
        await onAdd({
          name: name.trim(),
          description: description.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
          benefit: benefitType ?? null,
          asset_ids: benefitType === "files" ? selectedAssetIds : undefined,
          course_ids: benefitType === "courses" ? selectedCourseIds : undefined,
          link_items: benefitType === "links" ? validLinks : undefined,
        });
        toast.success(t("productSheet.productCreated"));
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("productSheet.saveError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col !max-w-[620px] !bg-card !border-l-0">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t("productSheet.editTitle") : t("productSheet.newTitle")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 py-2 overflow-y-auto px-1">
          {/* ─── Informações ─── */}
          <Section title={t("productSheet.sectionInfo")}>
            {isEdit && product?.public_id && (
              <div className="space-y-2">
                <Label htmlFor="product-public-id">
                  {t("common.id", { defaultValue: "ID" })}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="product-public-id"
                    value={product.public_id}
                    variant="readOnly"
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(product.public_id);
                      toast.success(t("common.idCopied"));
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="product-name">{t("productSheet.nameLabel")}</Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("productSheet.namePlaceholder")}
                maxLength={FRONTEND_NAME_MAX_LENGTH}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="product-description">{t("productSheet.descriptionLabel")}</Label>
              <Textarea
                {...NO_AUTOFILL_PROPS}
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("productSheet.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            {/* Cover image */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Capa do produto</p>
                <p className="text-xs text-muted-foreground">
                  Exibida no Portal do cliente. Proporção 1:1.
                </p>
              </div>

              <div
                className="relative w-full aspect-square rounded-xl bg-muted border border-border flex items-center justify-center cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {coverPreviewUrl ? (
                  <>
                    <img
                      src={coverPreviewUrl}
                      alt="Capa do produto"
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
                        <span className="text-xs">{t("productSheet.clickToUpload")}</span>
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
                    onClick={() => {
                      setCoverUrl("");
                      setCoverPreviewUrl("");
                    }}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    {t("common.remove")}
                  </Button>
                )}

                {isUnsplashConfigured() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUnsplashOpen(true)}
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
                onChange={handleImageSelect}
                className="hidden"
              />

              <UnsplashPickerDialog
                open={unsplashOpen}
                onOpenChange={setUnsplashOpen}
                onSelect={(blob) => handleUnsplashSelect(blob)}
              />

              <CoverCropDialog
                open={cropDialogOpen}
                onOpenChange={(open) => {
                  setCropDialogOpen(open);
                  if (!open && cropImageSrc) {
                    URL.revokeObjectURL(cropImageSrc);
                    setCropImageSrc("");
                  }
                }}
                imageSrc={cropImageSrc}
                onConfirm={handleCropConfirm}
                aspect={1}
                targetWidth={800}
                targetHeight={800}
                dialogDescription="Ajuste a área de recorte para o formato quadrado 1:1"
              />
            </div>
          </Section>

          {/* ─── Entregável ─── */}
          <Section title={t("productSheet.sectionDeliverable")} defaultOpen={false}>
            {isEdit && product?.benefit ? (
              /* Edit mode: type is locked */
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <Lock className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {product.benefit === "files"
                        ? t("productSheet.fileDownload")
                        : product.benefit === "links"
                        ? t("productSheet.externalLink")
                        : t("productSheet.course")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("productSheet.typeLocked")}
                    </p>
                  </div>
                </div>

                {/* Edit: assets selection */}
                {product.benefit === "files" && (
                  <ProductAssetSelectionList
                    label={t("productSheet.linkedAssets")}
                    assets={assets}
                    assetSearch={assetSearch}
                    loading={loadingOptions}
                    selectedAssetIds={selectedAssetIds}
                    onAssetSearchChange={setAssetSearch}
                    onSelectedAssetIdsChange={setSelectedAssetIds}
                    onUploadClick={inlineUpload.triggerUpload}
                    pendingItems={inlineUpload.pendingItems}
                    disableUpload={selectedAssetIds.length >= 10}
                  />
                )}

                {/* Edit: courses selection */}
                {product.benefit === "courses" && (
                  <ProductCourseSelectionList
                    label={t("productSheet.linkedCourses")}
                    courses={courses}
                    loading={loadingOptions}
                    selectedCourseIds={selectedCourseIds}
                    onSelectedCourseIdsChange={setSelectedCourseIds}
                  />
                )}

                {/* Edit: links input */}
                {product.benefit === "links" && (
                  <ProductLinkInputList
                    label={t("productSheet.linkedLinks")}
                    linkItems={linkItems}
                    onLinkItemsChange={setLinkItems}
                  />
                )}
              </>
            ) : (
              /* Create or edit without benefit: choose type (optional) */
              <>
                <div>
                  <Label>{t("productSheet.deliverableTypeLabel")}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("productSheet.deliverableTypeDesc")}
                  </p>
                </div>

                <ProductBenefitTypeCards
                  benefitType={benefitType}
                  onBenefitTypeChange={handleBenefitTypeChange}
                />

                {/* Files selection */}
                {benefitType === "files" && (
                  <ProductAssetSelectionList
                    label={t("productSheet.selectAssets")}
                    assets={assets}
                    assetSearch={assetSearch}
                    loading={loadingOptions}
                    selectedAssetIds={selectedAssetIds}
                    onAssetSearchChange={setAssetSearch}
                    onSelectedAssetIdsChange={setSelectedAssetIds}
                    onUploadClick={inlineUpload.triggerUpload}
                    pendingItems={inlineUpload.pendingItems}
                    disableUpload={selectedAssetIds.length >= 10}
                  />
                )}

                {/* Courses selection */}
                {benefitType === "courses" && (
                  <ProductCourseSelectionList
                    label={t("productSheet.selectCourses")}
                    courses={courses}
                    loading={loadingOptions}
                    selectedCourseIds={selectedCourseIds}
                    onSelectedCourseIdsChange={setSelectedCourseIds}
                  />
                )}

                {/* Links input */}
                {benefitType === "links" && (
                  <ProductLinkInputList
                    label={t("productSheet.selectLinks")}
                    linkItems={linkItems}
                    onLinkItemsChange={setLinkItems}
                  />
                )}
              </>
            )}
          </Section>

        </div>

        {/* Hidden file input for inline asset upload */}
        <input
          ref={inlineUpload.uploadInputRef}
          type="file"
          onChange={inlineUpload.handleFileSelect}
          className="hidden"
        />

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? t("common.save") : t("productSheet.createProduct")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
