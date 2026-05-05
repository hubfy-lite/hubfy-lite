import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Ban } from "lucide-react";
import { useInView } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

/**
 * Curated background images stored in /public/images/portal-backgrounds/.
 * Full: {base}.webp  |  Thumbnail: {base}_thumb.webp
 * To add a new image, drop both files and add the base name here.
 */
const BACKGROUNDS: string[] = [
  "agefis-eqvAIznVqR4-unsplash",
  "alex-lvrs-2zDw14yCYqk-unsplash",
  "anastase-maragos-jzP8_Rg6aVU-unsplash",
  "andrew-neel-ute2XAFQU2I-unsplash",
  "arif-riyanto-G1N9kDHqBrQ-unsplash",
  "beth-jnr-NtfFqT8JBI0-unsplash",
  "birgith-roosipuu-tXqwCqGorTI-unsplash",
  "birk-enwald-cdiAOvbwEgE-unsplash",
  "charlesdeluvio-rRWiVQzLm7k-unsplash",
  "christopher-campbell-RDPmcgy7Ay4-unsplash",
  "clem-onojeghuo-n6gnCa77Urc-unsplash",
  "creatopy-BrDJ-OauGxQ-unsplash",
  "delaney-van-Mzu7qcmP5tk-unsplash",
  "diego-ph-fIq0tET6llw-unsplash",
  "doina-gavrilov-sVF7a3ifsI8-unsplash",
  "edgar-chaparro-sHfo3WOgGTU-unsplash",
  "jaredd-craig-HH4WBGNyltc-unsplash",
  "jennifer-burk-ECXB0YAZ_zU-unsplash",
  "kevin-matos-Nl_FMFpXo2g-unsplash",
  "marissa-grootes-zv5QSKaP8G8-unsplash",
  "michael-soledad-9juYjd6iQLU-unsplash",
  "microsoft-edge-Px0X7g1mc8k-unsplash",
  "minh-pham-lB9ylP8e9Sg-unsplash",
  "nathan-dumlao-xPHmmVKS8lM-unsplash",
  "nrd-c3tNiAb098I-unsplash",
  "olena-bohovyk-dIMJWLx1YbE-unsplash",
  "ouerghammi-montassar-UfBHHY9GtH4-unsplash",
  "patrick-robert-doyle-G_xCmQ4HyAM-unsplash",
  "priscilla-du-preez-nNMBa7Y1Ymk-unsplash",
  "samuel-myles-4hppPVIwWyE-unsplash",
  "siora-photography-ZslFOaqzERU-unsplash",
  "tamanna-rumee-vaTsR-ghLog-unsplash",
  "tuyen-vo-7o7DqXJArf4-unsplash",
  "victoria-nazaruk-j3GgpGHsutA-unsplash",
  "vitaliy-grin-cm4DEO2RPEo-unsplash",
];

function thumbUrl(base: string) {
  return `/images/portal-backgrounds/${base}_thumb.webp`;
}

function fullUrl(base: string) {
  return `/images/portal-backgrounds/${base}.webp`;
}

/** Default portal background when the admin hasn't chosen one yet. */
export const DEFAULT_PORTAL_BG = fullUrl("olena-bohovyk-dIMJWLx1YbE-unsplash");

/** Split array into N roughly-equal columns (round-robin) */
function splitIntoColumns<T>(items: T[], cols: number): T[][] {
  const columns: T[][] = Array.from({ length: cols }, () => []);
  items.forEach((item, i) => columns[i % cols].push(item));
  return columns;
}

/* ------------------------------------------------------------------ */
/*  AnimatedImage – fade-in on scroll with loading state              */
/* ------------------------------------------------------------------ */
interface AnimatedImageProps {
  base: string;
  isSelected: boolean;
  onSelect: () => void;
}

function AnimatedImage({ base, isSelected, onSelect }: AnimatedImageProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const isInView = useInView(ref, { once: true });
  const [isLoading, setIsLoading] = React.useState(true);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-lg border-2 overflow-hidden transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-muted-foreground/40",
      )}
    >
      <AspectRatio ratio={16 / 10} className="bg-muted relative size-full">
        <img
          alt={base}
          src={thumbUrl(base)}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          className={cn(
            "size-full rounded-lg object-cover transition-all duration-700 ease-in-out",
            isInView && !isLoading ? "opacity-100 scale-100" : "opacity-0 scale-105",
          )}
        />
      </AspectRatio>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />

      {/* Selected badge */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
          <Check className="size-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  PhotoGalleryModal                                                 */
/* ------------------------------------------------------------------ */
interface PhotoGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUrl: string | null;
  onSelect: (url: string | null) => void;
}

export default function PhotoGalleryModal({
  open,
  onOpenChange,
  selectedUrl,
  onSelect,
}: PhotoGalleryModalProps) {
  const { t } = useTranslation();
  const columns = React.useMemo(() => splitIntoColumns(BACKGROUNDS, 3), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle>{t("designPage.loginPage.galleryTitle")}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh] pr-1 -mr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* "No image" option — always first in first column */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => onSelect(null)}
                className={cn(
                  "relative w-full rounded-lg border-2 overflow-hidden transition-all flex items-center justify-center bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selectedUrl === null
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent hover:border-muted-foreground/40",
                )}
              >
                <AspectRatio ratio={16 / 10} className="flex items-center justify-center">
                  <Ban className="size-6 text-muted-foreground" />
                </AspectRatio>
                {selectedUrl === null && (
                  <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                    <Check className="size-3 text-primary-foreground" />
                  </div>
                )}
              </button>

              {/* First column items */}
              {columns[0].map((base) => (
                <AnimatedImage
                  key={base}
                  base={base}
                  isSelected={selectedUrl === fullUrl(base)}
                  onSelect={() => onSelect(fullUrl(base))}
                />
              ))}
            </div>

            {/* Remaining columns */}
            {columns.slice(1).map((colItems, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-3">
                {colItems.map((base) => (
                  <AnimatedImage
                    key={base}
                    base={base}
                    isSelected={selectedUrl === fullUrl(base)}
                    onSelect={() => onSelect(fullUrl(base))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
