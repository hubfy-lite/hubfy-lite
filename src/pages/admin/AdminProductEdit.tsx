import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Loader2,
  Upload,
  ImageIcon,
  Trash2,
  Lock,
  Search,
  Link as LinkIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useProducts, type BenefitType } from "@/hooks/useProducts";
import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";
import { CoverCropDialog } from "@/components/admin/CoverCropDialog";
import {
  ProductAssetSelectionList,
  ProductBenefitTypeCards,
  ProductCourseSelectionList,
  ProductLinkInputList,
  type DeliverableAssetOption,
  type DeliverableCourseOption,
} from "@/components/admin/ProductDeliverableFields";
import type { LinkItem } from "@/hooks/useProducts";
import { isUnsplashConfigured } from "@/lib/unsplash";
import { cleanCoverValue, getCoversPublicUrl } from "@/lib/storage-urls";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import { translateAppError } from "@/lib/app-error-utils";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useInlineAssetUpload } from "@/hooks/useInlineAssetUpload";

/* ─── Types ─── */

type AssetOption = DeliverableAssetOption;

interface CourseOption extends DeliverableCourseOption {
  cover_horizontal_url: string | null;
  updated_at: string | number | null;
}

type Tab = "info" | "benefits";

/* ─── Main Page ─── */

export default function AdminProductEdit() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const {
    updateProduct,
    setProductDeliverable,
  } = useProducts();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTab = (searchParams.get("tab") as Tab) || "info";
  const setActiveTab = (tab: Tab) => {
    setSearchParams(tab === "info" ? {} : { tab }, { replace: true });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "info", label: t("productEdit.tabs.info") },
    { id: "benefits", label: t("productEdit.tabs.benefits") },
  ];

  // Fetch product
  const { data: product, isPending } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("public_id", productId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

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

  // Initial values for dirty check
  const initialAssetIdsRef = useRef<string[]>([]);
  const initialCourseIdsRef = useRef<string[]>([]);
  const initialLinkItemsRef = useRef<LinkItem[]>([]);


  // Set page title to product name
  usePageTitle(product?.name);

  // Gateway mapping badge: check if product has active gateway mapping
  const { data: gatewayMapping } = useQuery({
    queryKey: ["product-gateway-mapping", product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      const { data } = await supabase
        .from("gateway_product_mappings")
        .select("id, integration:tenant_integrations!inner(provider, status)")
        .eq("product_id", product.id)
        .eq("integration.status", "active")
        .limit(1)
        .maybeSingle();
      return data as { id: string; integration: { provider: string; status: string } } | null;
    },
    enabled: !!product?.id,
  });

  // Dirty state
  const isDirtyInfo = useMemo(() => {
    if (!product) return false;
    const cleanCover = cleanCoverValue(product.cover_url) ?? "";
    return (
      name !== product.name ||
      description !== (product.description ?? "") ||
      coverUrl !== cleanCover
    );
  }, [product, name, description, coverUrl]);

  const isDirtyBenefits = useMemo(() => {
    if (!product) return false;

    if (product.benefit === "files") {
      const initial = initialAssetIdsRef.current;
      if (selectedAssetIds.length !== initial.length) return true;
      return !selectedAssetIds.every((id, i) => id === initial[i]);
    }
    if (product.benefit === "courses") {
      const initial = initialCourseIdsRef.current;
      const sortedSelected = [...selectedCourseIds].sort();
      const sortedInitial = [...initial].sort();
      if (sortedSelected.length !== sortedInitial.length) return true;
      return !sortedSelected.every((id, i) => id === sortedInitial[i]);
    }
    if (product.benefit === "links") {
      const initial = initialLinkItemsRef.current;
      if (linkItems.length !== initial.length) return true;
      return !linkItems.every(
        (item, i) =>
          item.url === initial[i]?.url &&
          item.title === initial[i]?.title &&
          (item.description ?? "") === (initial[i]?.description ?? "")
      );
    }

    if (product.benefit || !benefitType) return false;

    if (benefitType === "files") {
      return selectedAssetIds.length > 0;
    }
    if (benefitType === "courses") {
      return selectedCourseIds.length > 0;
    }
    if (benefitType === "links") {
      return linkItems.filter((l) => l.url.trim() && l.title.trim()).length > 0;
    }

    return false;
  }, [product, benefitType, selectedAssetIds, selectedCourseIds, linkItems]);

  // Init form from product
  useEffect(() => {
    if (!product) return;
    const clean = cleanCoverValue(product.cover_url);
    setName(product.name);
    setDescription(product.description ?? "");
    setCoverUrl(clean ?? "");
    setCoverPreviewUrl(clean ? getCoversPublicUrl(clean, product.updated_at) : "");
    setBenefitType((product.benefit as BenefitType | null) ?? null);
    setAssetSearch("");
  }, [product]);

  // Fetch asset/course options
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
          .select("id, title, cover_horizontal_url, updated_at, category")
          .eq("tenant_id", tenant.id)
          .order("title"),
      ]);
      setAssets(assetsRes.data ?? []);
      setCourses(
        (coursesRes.data ?? []).map((c) => ({
          ...c,
          title: limitNameLength(c.title),
        }))
      );
    } catch {
      // silent
    } finally {
      setLoadingOptions(false);
    }
  }, [tenant?.id]);

  // Fetch existing links — uses resolved product UUID
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
      const assetIds = assetsRes.data?.map((r) => r.asset_id) ?? [];
      const courseIds = coursesRes.data?.map((r) => r.course_id) ?? [];
      const links: LinkItem[] = (linksRes.data ?? []).map((r) => ({
        url: r.url,
        title: r.title,
        description: r.description ?? undefined,
      }));
      setSelectedAssetIds(assetIds);
      setSelectedCourseIds(courseIds);
      setLinkItems(links);
      initialAssetIdsRef.current = assetIds;
      initialCourseIdsRef.current = courseIds;
      initialLinkItemsRef.current = links;
    } catch {
      // silent
    }
  }, [product?.id]);

  useEffect(() => {
    fetchOptions();
    fetchExistingLinks();
  }, [fetchOptions, fetchExistingLinks]);

  const handleNameChange = (value: string) => {
    setName(limitNameLength(value));
  };

  // Image handling
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

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
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
    },
    [product?.id, tenant?.id, t, cropImageSrc]
  );

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

  // Save handlers
  const handleSaveInfo = async () => {
    if (!product?.id || !name.trim()) {
      toast.error(t("productSheet.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name: name.trim(),
        description: description.trim() || null,
        cover_url: coverUrl.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(t("productSheet.productUpdated"));
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("productSheet.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBenefits = async () => {
    if (!product?.id) return;

    const benefit = product.benefit ?? benefitType;
    if (!benefit) {
      toast.error(t("productSheet.deliverableRequired"));
      return;
    }

    if (benefit === "files" && selectedAssetIds.length === 0) {
      toast.error(t("productSheet.assetsRequired"));
      return;
    }

    if (benefit === "courses" && selectedCourseIds.length === 0) {
      toast.error(t("productSheet.coursesRequired"));
      return;
    }

    const validLinks = linkItems.filter((l) => l.url.trim() && l.title.trim());
    if (benefit === "links" && validLinks.length === 0) {
      toast.error(t("productSheet.linksRequired"));
      return;
    }

    setSaving(true);
    try {
      await setProductDeliverable(product.id, {
        benefit,
        asset_ids: benefit === "files" ? selectedAssetIds : undefined,
        course_ids: benefit === "courses" ? selectedCourseIds : undefined,
        link_items: benefit === "links" ? validLinks : undefined,
      });
      initialAssetIdsRef.current = [...selectedAssetIds];
      initialCourseIdsRef.current = [...selectedCourseIds];
      initialLinkItemsRef.current = [...linkItems];
      if (!product.benefit) {
        await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      }
      toast.success(t("productSheet.productUpdated"));
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("productSheet.saveError")));
    } finally {
      setSaving(false);
    }
  };

  if (isPending) {
    return (
      <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex h-full min-w-[800px] max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">{t("productEdit.notFound")}</p>
          <Button variant="outline" onClick={() => navigate("/admin/products")}>
            <ArrowLeft className="size-4" />
            {t("productEdit.backToProducts")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex h-full min-w-[800px] max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="size-8 p-0" onClick={() => navigate("/admin/products")}>
              <ArrowLeft className="size-3.5" />
            </Button>
            <h1 className="text-title min-w-0 truncate">{product.name}</h1>
            {gatewayMapping && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="shrink-0 gap-1 cursor-default capitalize">
                      <LinkIcon className="size-3" />
                      {(gatewayMapping.integration as { provider: string }).provider}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Para alterar o vínculo, acesse Integrações &gt; {(gatewayMapping.integration as { provider: string }).provider} &gt; Mapeamento</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
          >
            <TabsList variant="line" className="shrink-0 border-b border-border w-full justify-start">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ─── Tab: Info ─── */}
            <TabsContent value="info" className="mt-8 space-y-8">
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel>{t("common.id", { defaultValue: "ID" })}</FieldLabel>
                </FieldContent>
                <FieldControl>
                  <div className="flex items-center gap-2">
                    <Input
                      value={product.public_id ?? "—"}
                      variant="readOnly"
                      readOnly
                    />
                    {product.public_id && (
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
                    )}
                  </div>
                </FieldControl>
              </Field>

              {/* Name */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel>{t("productSheet.nameLabel")}</FieldLabel>
                  <FieldDescription>{t("productSheet.namePlaceholder")}</FieldDescription>
                </FieldContent>
                <FieldControl>
                  <Input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={t("productSheet.namePlaceholder")}
                    maxLength={FRONTEND_NAME_MAX_LENGTH}
                  />
                </FieldControl>
              </Field>

              {/* Description */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel>{t("productSheet.descriptionLabel")}</FieldLabel>
                  <FieldDescription>{t("productSheet.descriptionPlaceholder")}</FieldDescription>
                </FieldContent>
                <FieldControl>
                  <Textarea
                    {...NO_AUTOFILL_PROPS}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("productSheet.descriptionPlaceholder")}
                    rows={3}
                  />
                </FieldControl>
              </Field>

              {/* Cover image */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel>{t("productSheet.coverTitle")}</FieldLabel>
                  <FieldDescription>{t("productSheet.coverDesc")}</FieldDescription>
                </FieldContent>
                <FieldControl>
                  <div className="space-y-3">
                    <div
                      className="relative w-full max-w-[280px] aspect-square rounded-xl bg-muted border border-border flex items-center justify-center cursor-pointer group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {coverPreviewUrl ? (
                        <>
                          <img
                            src={coverPreviewUrl}
                            alt=""
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
                  </div>
                </FieldControl>
              </Field>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveInfo} disabled={saving || !isDirtyInfo}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {t("common.save")}
                </Button>
              </div>
            </TabsContent>

            {/* ─── Tab: Benefits ─── */}
            <TabsContent value="benefits" className="mt-8 space-y-8">
              {product.benefit ? (
                <>
                  {/* Locked type indicator */}
                  <Field orientation="split">
                    <FieldContent>
                      <FieldLabel>{t("productSheet.benefitType")}</FieldLabel>
                      <FieldDescription>{t("productSheet.typeLocked")}</FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                        <Lock className="size-4 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium text-foreground">
                          {product.benefit === "files"
                            ? t("productSheet.fileDownload")
                            : product.benefit === "links"
                            ? t("productSheet.externalLink")
                            : t("productSheet.course")}
                        </p>
                      </div>
                    </FieldControl>
                  </Field>

                  <FieldSeparator />

                  {/* Assets selection */}
                  {product.benefit === "files" && (
                    <Field orientation="split">
                      <FieldContent>
                        <FieldLabel>{t("productSheet.linkedAssets")}</FieldLabel>
                        <FieldDescription>
                          {selectedAssetIds.length}/10
                        </FieldDescription>
                      </FieldContent>
                      <FieldControl>
                        <ProductAssetSelectionList
                          label={t("productSheet.linkedAssets")}
                          assets={assets}
                          assetSearch={assetSearch}
                          loading={loadingOptions}
                          selectedAssetIds={selectedAssetIds}
                          showHeader={false}
                          onAssetSearchChange={setAssetSearch}
                          onSelectedAssetIdsChange={setSelectedAssetIds}
                          onUploadClick={inlineUpload.triggerUpload}
                          pendingItems={inlineUpload.pendingItems}
                          disableUpload={selectedAssetIds.length >= 10}
                        />
                      </FieldControl>
                    </Field>
                  )}

                  {/* Courses selection — list */}
                  {product.benefit === "courses" && (
                    <Field orientation="split">
                      <FieldContent>
                        <FieldLabel>{t("productSheet.linkedCourses")}</FieldLabel>
                        <FieldDescription>
                          {selectedCourseIds.length} {t("productSheet.selected")}
                        </FieldDescription>
                      </FieldContent>
                      <FieldControl>
                        <ProductCourseSelectionList
                          label={t("productSheet.linkedCourses")}
                          courses={courses}
                          loading={loadingOptions}
                          selectedCourseIds={selectedCourseIds}
                          showHeader={false}
                          onSelectedCourseIdsChange={setSelectedCourseIds}
                        />
                      </FieldControl>
                    </Field>
                  )}

                  {/* Links input */}
                  {product.benefit === "links" && (
                    <Field orientation="split">
                      <FieldContent>
                        <FieldLabel>{t("productSheet.linkedLinks")}</FieldLabel>
                        <FieldDescription>
                          {linkItems.length}/20
                        </FieldDescription>
                      </FieldContent>
                      <FieldControl>
                        <ProductLinkInputList
                          label={t("productSheet.linkedLinks")}
                          linkItems={linkItems}
                          showHeader={false}
                          onLinkItemsChange={setLinkItems}
                        />
                      </FieldControl>
                    </Field>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveBenefits} disabled={saving || !isDirtyBenefits}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      {t("common.save")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Field orientation="split">
                    <FieldContent>
                      <FieldLabel>{t("productSheet.deliverableTypeLabel")}</FieldLabel>
                      <FieldDescription>{t("productSheet.deliverableTypeDesc")}</FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <ProductBenefitTypeCards
                        benefitType={benefitType}
                        onBenefitTypeChange={handleBenefitTypeChange}
                      />
                    </FieldControl>
                  </Field>

                  {benefitType && <FieldSeparator />}

                  {benefitType === "files" && (
                    <Field orientation="split">
                      <FieldContent>
                        <FieldLabel>{t("productSheet.selectAssets")}</FieldLabel>
                        <FieldDescription>{selectedAssetIds.length}/10</FieldDescription>
                      </FieldContent>
                      <FieldControl>
                        <ProductAssetSelectionList
                          label={t("productSheet.selectAssets")}
                          assets={assets}
                          assetSearch={assetSearch}
                          loading={loadingOptions}
                          selectedAssetIds={selectedAssetIds}
                          showHeader={false}
                          onAssetSearchChange={setAssetSearch}
                          onSelectedAssetIdsChange={setSelectedAssetIds}
                          onUploadClick={inlineUpload.triggerUpload}
                          pendingItems={inlineUpload.pendingItems}
                          disableUpload={selectedAssetIds.length >= 10}
                        />
                      </FieldControl>
                    </Field>
                  )}

                  {benefitType === "courses" && (
                    <Field orientation="split">
                      <FieldContent>
                        <FieldLabel>{t("productSheet.selectCourses")}</FieldLabel>
                        <FieldDescription>
                          {selectedCourseIds.length} {t("productSheet.selected")}
                        </FieldDescription>
                      </FieldContent>
                      <FieldControl>
                        <ProductCourseSelectionList
                          label={t("productSheet.selectCourses")}
                          courses={courses}
                          loading={loadingOptions}
                          selectedCourseIds={selectedCourseIds}
                          showHeader={false}
                          onSelectedCourseIdsChange={setSelectedCourseIds}
                        />
                      </FieldControl>
                    </Field>
                  )}

                  {benefitType === "links" && (
                    <Field orientation="split">
                      <FieldContent>
                        <FieldLabel>{t("productSheet.selectLinks")}</FieldLabel>
                        <FieldDescription>{linkItems.length}/20</FieldDescription>
                      </FieldContent>
                      <FieldControl>
                        <ProductLinkInputList
                          label={t("productSheet.selectLinks")}
                          linkItems={linkItems}
                          showHeader={false}
                          onLinkItemsChange={setLinkItems}
                        />
                      </FieldControl>
                    </Field>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveBenefits} disabled={saving || !isDirtyBenefits}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      {t("common.save")}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Hidden file input for inline asset upload */}
      <input
        ref={inlineUpload.uploadInputRef}
        type="file"
        onChange={inlineUpload.handleFileSelect}
        className="hidden"
      />

      {/* Dialogs */}
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
        dialogDescription={t("productSheet.coverDesc")}
      />
    </>
  );
}
