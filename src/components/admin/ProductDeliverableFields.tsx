import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BookOpen,
  ExternalLink,
  FileDown,
  FileIcon,
  LibraryBig,
  Link2,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, type CourseCategory } from "@/lib/course-categories";
import type { BenefitType, LinkItem } from "@/hooks/useProducts";
import type { PendingAssetItem } from "@/hooks/useInlineAssetUpload";

export interface DeliverableAssetOption {
  id: string;
  title: string;
  mime_type: string | null;
  size_bytes: number | null;
}

export interface DeliverableCourseOption {
  id: string;
  title: string;
  category: string | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface BenefitTypeCardsProps {
  benefitType: BenefitType | null;
  onBenefitTypeChange: (benefit: BenefitType) => void;
}

export function ProductBenefitTypeCards({
  benefitType,
  onBenefitTypeChange,
}: BenefitTypeCardsProps) {
  const { t } = useTranslation();

  const cards: { type: BenefitType; icon: typeof FileDown; label: string }[] = [
    { type: "files", icon: FileDown, label: t("productSheet.fileDownload") },
    { type: "courses", icon: BookOpen, label: t("productSheet.course") },
    { type: "links", icon: Link2, label: t("productSheet.externalLink") },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          type="button"
          onClick={() => onBenefitTypeChange(type)}
          className={`flex flex-col items-center gap-2.5 rounded-xl p-4 text-center transition-all ${
            benefitType === type
              ? "border-2 border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border border-border bg-muted/30 hover:border-primary/30"
          }`}
        >
          <div
            className={`flex size-10 items-center justify-center rounded-lg ${
              benefitType === type ? "bg-primary/10" : "bg-muted"
            }`}
          >
            <Icon
              className={`size-5 ${
                benefitType === type ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <p className="text-sm font-medium text-foreground">{label}</p>
        </button>
      ))}
    </div>
  );
}

interface AssetSelectionListProps {
  label: string;
  assets: DeliverableAssetOption[];
  assetSearch: string;
  loading: boolean;
  selectedAssetIds: string[];
  showHeader?: boolean;
  onAssetSearchChange: (value: string) => void;
  onSelectedAssetIdsChange: (ids: string[]) => void;
  /** Inline upload support (optional) */
  onUploadClick?: () => void;
  pendingItems?: PendingAssetItem[];
  disableUpload?: boolean;
}

export function ProductAssetSelectionList({
  label,
  assets,
  assetSearch,
  loading,
  selectedAssetIds,
  showHeader = true,
  onAssetSearchChange,
  onSelectedAssetIdsChange,
  onUploadClick,
  pendingItems = [],
  disableUpload,
}: AssetSelectionListProps) {
  const { t } = useTranslation();

  const toggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      onSelectedAssetIdsChange(selectedAssetIds.filter((id) => id !== assetId));
      return;
    }

    if (selectedAssetIds.length >= 10) {
      toast.error(t("productSheet.maxAssets"));
      return;
    }

    onSelectedAssetIdsChange([...selectedAssetIds, assetId]);
  };

  const hasPending = pendingItems.length > 0;
  const showEmptyState = !loading && assets.length === 0 && !hasPending;

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <span className="text-xs text-muted-foreground">
            {selectedAssetIds.length}/10
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : showEmptyState ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <FileDown className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("productSheet.noAssetsAvailable")}
          </p>
          <div className="flex items-center gap-2">
            {onUploadClick && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onUploadClick}
                disabled={disableUpload}
              >
                <Upload className="mr-1.5 size-3.5" />
                {t("productSheet.uploadFile")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open("/admin/assets", "_blank")}
            >
              {t("productSheet.goToAssets")}
              <ExternalLink className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("productSheet.searchAsset")}
                value={assetSearch}
                onChange={(e) => onAssetSearchChange(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            {onUploadClick && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={onUploadClick}
                disabled={disableUpload}
              >
                <Upload className="mr-1.5 size-3.5" />
                {t("productSheet.uploadFile")}
              </Button>
            )}
          </div>
          <div className="max-h-[280px] space-y-1 overflow-y-auto">
            {/* Pending upload items — always visible, independent of search */}
            {pendingItems.map((item) => (
              <div
                key={item.tempId}
                className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5"
              >
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("productSheet.uploadingFile", { title: "" }).replace(/""/g, "").trim() || `${item.progress}%`}
                  </p>
                </div>
              </div>
            ))}
            {/* Existing assets filtered by search */}
            {assets
              .filter((asset) =>
                asset.title.toLowerCase().includes(assetSearch.toLowerCase())
              )
              .map((asset) => {
                const checked = selectedAssetIds.includes(asset.id);
                return (
                  <label
                    key={asset.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors ${
                      checked
                        ? "border border-primary/20 bg-primary/5"
                        : "border border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleAsset(asset.id)}
                    />
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {asset.title}
                      </p>
                      {asset.size_bytes && (
                        <p className="text-xs text-muted-foreground">
                          {formatSize(asset.size_bytes)}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

interface CourseSelectionListProps {
  label: string;
  courses: DeliverableCourseOption[];
  loading: boolean;
  selectedCourseIds: string[];
  showHeader?: boolean;
  onSelectedCourseIdsChange: (ids: string[]) => void;
}

export function ProductCourseSelectionList({
  label,
  courses,
  loading,
  selectedCourseIds,
  showHeader = true,
  onSelectedCourseIdsChange,
}: CourseSelectionListProps) {
  const { t } = useTranslation();

  const toggleCourse = (courseId: string) => {
    if (selectedCourseIds.includes(courseId)) {
      onSelectedCourseIdsChange(
        selectedCourseIds.filter((id) => id !== courseId)
      );
      return;
    }

    onSelectedCourseIdsChange([...selectedCourseIds, courseId]);
  };

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <span className="text-xs text-muted-foreground">
            {selectedCourseIds.length} {t("productSheet.selected")}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("productSheet.noCoursesAvailable")}
          </p>
        </div>
      ) : (
        <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
          {courses.map((course) => {
            const checked = selectedCourseIds.includes(course.id);
            const categoryLabel = course.category
              ? CATEGORY_LABELS[course.category as CourseCategory] ?? null
              : null;

            return (
              <label
                key={course.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  checked
                    ? "border-primary bg-muted/50"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <LibraryBig className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {course.title}
                  </p>
                  {categoryLabel && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {categoryLabel}
                    </p>
                  )}
                </div>
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleCourse(course.id)}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Link input list ─── */

interface LinkInputListProps {
  label: string;
  linkItems: LinkItem[];
  showHeader?: boolean;
  onLinkItemsChange: (items: LinkItem[]) => void;
}

export function ProductLinkInputList({
  label,
  linkItems,
  showHeader = true,
  onLinkItemsChange,
}: LinkInputListProps) {
  const { t } = useTranslation();

  const addLink = () => {
    if (linkItems.length >= 20) {
      toast.error(t("productSheet.maxLinks"));
      return;
    }
    onLinkItemsChange([...linkItems, { url: "", title: "" }]);
  };

  const removeLink = (index: number) => {
    onLinkItemsChange(linkItems.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: keyof LinkItem, value: string) => {
    onLinkItemsChange(
      linkItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <span className="text-xs text-muted-foreground">
            {linkItems.length}/20
          </span>
        </div>
      )}

      <div className="max-h-[360px] space-y-2 overflow-y-auto">
        {linkItems.map((item, index) => (
          <div
            key={index}
            className="rounded-lg border border-border p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder={t("productSheet.linkTitlePlaceholder")}
                  value={item.title}
                  onChange={(e) => updateLink(index, "title", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder={t("productSheet.linkUrlPlaceholder")}
                  value={item.url}
                  onChange={(e) => updateLink(index, "url", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder={t("productSheet.linkDescriptionPlaceholder")}
                  value={item.description ?? ""}
                  onChange={(e) => updateLink(index, "description", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeLink(index)}
                className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addLink}
        disabled={linkItems.length >= 20}
      >
        <Plus className="size-3.5 mr-1.5" />
        {t("productSheet.addLink")}
      </Button>
    </div>
  );
}
