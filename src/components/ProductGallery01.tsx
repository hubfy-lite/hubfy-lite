import { cn } from "@/lib/utils";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export interface ProductGallery01Item {
  id: string;
  title: string;
  description?: string | null;
  badge?: string | null;
  badgeVariant?: BadgeProps["variant"];
  imageSrc: string;
  onClick?: () => void;
  muted?: boolean;
}

interface ProductGallery01Props {
  className?: string;
  title: string;
  description?: string;
  descriptionColor?: string;
  items: ProductGallery01Item[];
  emptyState?: React.ReactNode;
  radiusClass?: string;
  themeMode?: "dark" | "light";
}

const ProductGallery01 = ({
  className,
  title,
  description,
  descriptionColor,
  items,
  emptyState,
  radiusClass = "rounded-[10px]",
  themeMode = "dark",
}: ProductGallery01Props) => {
  const isDark = themeMode === "dark";
  const titleClassName = isDark ? "text-white" : "text-foreground";
  const mutedClassName = isDark ? "text-white/62" : "text-muted-foreground";
  const imageBgClassName = isDark ? "bg-white/5" : "bg-muted";
  const navButtonClassName = isDark
    ? "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
    : "border-border bg-background text-foreground hover:bg-muted hover:text-foreground";

  const renderItem = (item: ProductGallery01Item) => (
    <button
      key={item.id}
      type="button"
      onClick={item.onClick}
      disabled={!item.onClick}
      className={cn(
        "group block w-full text-left disabled:cursor-default",
        item.muted && "opacity-45"
      )}
    >
      <div
        className={cn(
          "relative aspect-square overflow-hidden",
          imageBgClassName,
          radiusClass
        )}
      >
        <img
          src={item.imageSrc}
          alt={item.title}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="mt-4">
        {item.badge ? (
          <Badge variant={item.badgeVariant ?? "secondary"} className="mb-2 text-[11px]">
            {item.badge}
          </Badge>
        ) : null}
        <h3 className={cn("line-clamp-3 text-lg font-semibold tracking-tight", titleClassName)}>
          {item.title}
        </h3>
      </div>
    </button>
  );

  return (
    <section className={cn("relative py-16 md:py-24", className)}>
      <div className="w-full">
        <div className="max-w-3xl">
          <h1 className={cn("text-2xl font-semibold tracking-tight md:text-3xl", titleClassName)}>
            {title}
          </h1>
          {description ? (
            <p
              className={cn("mt-3 max-w-2xl text-sm leading-6 md:text-base md:leading-7", !descriptionColor && mutedClassName)}
              style={descriptionColor ? { color: descriptionColor } : undefined}
            >
              {description}
            </p>
          ) : null}
        </div>

        {!items.length ? (
          <div className={cn("mt-12 flex min-h-[320px] items-center justify-center text-sm", mutedClassName)}>
            {emptyState ?? <p>Nenhum item encontrado.</p>}
          </div>
        ) : items.length <= 4 ? (
          <div className="mt-14 grid items-start gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => renderItem(item))}
          </div>
        ) : (
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="relative mt-14 w-full"
          >
            <div className="mb-6 flex items-center justify-end gap-2">
              <CarouselPrevious
                variant="outline"
                className={cn(
                  "static h-11 w-11 translate-y-0 rounded-full [&_svg]:size-5 disabled:opacity-35",
                  navButtonClassName
                )}
              />
              <CarouselNext
                variant="outline"
                className={cn(
                  "static h-11 w-11 translate-y-0 rounded-full [&_svg]:size-5 disabled:opacity-35",
                  navButtonClassName
                )}
              />
            </div>

            <CarouselContent className="-ml-6">
              {items.map((item) => (
                <CarouselItem
                  key={item.id}
                  className="pl-6 self-start md:basis-1/2 xl:basis-1/4"
                >
                  {renderItem(item)}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        )}
      </div>
    </section>
  );
};

export { ProductGallery01 };
