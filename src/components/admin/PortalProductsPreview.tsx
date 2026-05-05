import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import { Button } from "@/components/ui/button";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/components/ui/sortable";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import { useTheme } from "@/contexts/ThemeContext";
import { useTenant } from "@/hooks/useTenant";
import type { Product } from "@/hooks/useProducts";

const PORTAL_PRODUCT_FALLBACK = "/images/placeholders/product-portal-fallback.svg";

interface PortalProductsPreviewProps {
  products: Product[];
  onReorder: (orderedIds: string[]) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

// ─── Gallery item card (replicates ProductGallery01 renderItem) ──────

interface GalleryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  product: Product;
  radiusClass: string;
  isDark: boolean;
  isOverlay?: boolean;
}

const GalleryCard = React.forwardRef<HTMLDivElement, GalleryCardProps>(
  ({ product, radiusClass, isDark, isOverlay, className, style, ...props }, ref) => {
    const titleClassName = isDark ? "text-white" : "text-foreground";
    const imageBgClassName = isDark ? "bg-white/5" : "bg-muted";
    const handleBg = isDark
      ? "bg-black/60 text-white/70 hover:text-white"
      : "bg-white/80 text-black/50 hover:text-black shadow-sm";

    const imageSrc = product.cover_url
      ? getCoversOptimizedUrl(product.cover_url, "product-card", product.updated_at)
      : PORTAL_PRODUCT_FALLBACK;

    return (
      <div
        ref={ref}
        className={cn(
          "group block w-full text-left",
          isOverlay && "shadow-2xl",
          className
        )}
        style={style}
        {...props}
      >
        <div
          className={cn(
            "relative aspect-square overflow-hidden",
            imageBgClassName,
            radiusClass
          )}
        >
          {/* Drag handle — visible on hover, hidden in overlay (no SortableItem context) */}
          {!isOverlay && (
            <SortableItemHandle
              className={cn(
                "absolute top-3 left-3 z-10 rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100",
                handleBg
              )}
            >
              <GripVertical className="size-4" />
            </SortableItemHandle>
          )}

          <img
            src={imageSrc}
            alt={product.name}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div className="mt-4">
          <h3
            className={cn(
              "line-clamp-3 text-2xl font-semibold tracking-tight",
              titleClassName
            )}
          >
            {product.name}
          </h3>
        </div>
      </div>
    );
  }
);
GalleryCard.displayName = "GalleryCard";

// ─── Main component ──────────────────────────────────────────────────

export function PortalProductsPreview({
  products,
  onReorder,
  onDirtyChange,
  saveRef,
}: PortalProductsPreviewProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tenant } = useTenant();

  const isDark = theme === "dark";
  const bgColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const mutedClassName = isDark ? "text-white/62" : "text-muted-foreground";
  const navButtonClassName = isDark
    ? "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
    : "border-border bg-background text-foreground hover:bg-muted hover:text-foreground";
  const radiusClass =
    tenant?.portal_button_style === "rectangular"
      ? "rounded-none"
      : tenant?.portal_button_style === "pill"
        ? "rounded-[20px]"
        : "rounded-[8px]";

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.offsetWidth / 4;
    el.scrollBy({ left: direction === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  }, []);

  const [orderedProducts, setOrderedProducts] = useState<Product[]>(
    () => [...products].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [initialOrder, setInitialOrder] = useState<string[]>(
    () =>
      [...products]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => p.id)
  );
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => {
    if (orderedProducts.length !== initialOrder.length) return true;
    return orderedProducts.some((p, i) => p.id !== initialOrder[i]);
  }, [orderedProducts, initialOrder]);

  const showNavButtons = orderedProducts.length > 4;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onReorder(orderedProducts.map((p) => p.id));
      setInitialOrder(orderedProducts.map((p) => p.id));
      toast.success(t("products.portalPreview.saved"));
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("products.portalPreview.saveError")));
    } finally {
      setSaving(false);
    }
  }, [orderedProducts, onReorder, t]);

  const handleDiscard = useCallback(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const restored = initialOrder
      .map((id) => byId.get(id))
      .filter(Boolean) as Product[];
    setOrderedProducts(restored);
  }, [initialOrder, products]);

  // Expose dirty state and save function to parent
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave;
      return () => { saveRef.current = null; };
    }
  }, [saveRef, handleSave]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t("products.portalPreview.dragHint")}
      </p>

      {/* Portal preview — replicates ProductGallery01 layout */}
      <section
        className="relative rounded-xl py-8 md:py-12 px-4 sm:px-6"
        style={{ backgroundColor: bgColor }}
      >
        <div className="w-full">
          {orderedProducts.length === 0 ? (
            <div
              className={cn(
                "flex min-h-[200px] items-center justify-center text-sm",
                mutedClassName
              )}
            >
              <p>{t("products.portalPreview.noActive")}</p>
            </div>
          ) : (
            <Sortable
              value={orderedProducts}
              onValueChange={setOrderedProducts}
              getItemValue={(p) => p.id}
              orientation="horizontal"
            >
              {/* Nav buttons — same style as ProductGallery01 CarouselPrevious/Next */}
              {showNavButtons && (
                <div className="mb-6 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => scrollBy("left")}
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center border transition-colors",
                      navButtonClassName,
                      radiusClass
                    )}
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollBy("right")}
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center border transition-colors",
                      navButtonClassName,
                      radiusClass
                    )}
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              )}

              {/* Single row, 4 visible, scroll for overflow — matches Gallery01 carousel */}
              <SortableContent
                ref={scrollRef}
                className="flex items-start gap-6 overflow-x-auto scrollbar-none"
              >
                {orderedProducts.map((product) => (
                  <SortableItem key={product.id} value={product.id} asChild>
                    <GalleryCard
                      product={product}
                      radiusClass={radiusClass}
                      isDark={isDark}
                      className="w-[calc(25%-18px)] shrink-0"
                    />
                  </SortableItem>
                ))}
              </SortableContent>
              <SortableOverlay>
                {({ value }) => {
                  const product = orderedProducts.find((p) => p.id === value);
                  return product ? (
                    <GalleryCard
                      product={product}
                      radiusClass={radiusClass}
                      isDark={isDark}
                      isOverlay
                      className="w-60"
                    />
                  ) : null;
                }}
              </SortableOverlay>
            </Sortable>
          )}
        </div>
      </section>
    </div>
  );
}
