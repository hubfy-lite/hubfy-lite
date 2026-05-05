import {
  FullscreenModal,
  FullscreenModalContent,
  FullscreenModalClose,
  FullscreenModalTitle,
} from "@/components/ui/fullscreen-modal";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { buildGumletEmbedUrl } from "@/lib/video-settings";
import { X } from "lucide-react";

interface VideoPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gumletAssetId?: string | null;
  title: string;
  videoSettings?: unknown;
  fallbackColor?: string | null;
  captionsEnabled?: boolean;
  /** Direct embed URL (e.g. Vimeo player URL). When provided, takes precedence over gumletAssetId. */
  embedUrl?: string | null;
}

export function VideoPlayerModal({
  open,
  onOpenChange,
  gumletAssetId,
  title,
  videoSettings,
  fallbackColor,
  captionsEnabled,
  embedUrl: externalEmbedUrl,
}: VideoPlayerModalProps) {
  const embedUrl = externalEmbedUrl
    ?? (gumletAssetId ? buildGumletEmbedUrl(gumletAssetId, videoSettings, { fallbackColor, captionsEnabled }) : null);

  if (!embedUrl) return null;

  return (
    <FullscreenModal open={open} onOpenChange={onOpenChange}>
      <FullscreenModalContent
        showCloseButton={false}
        className="bg-black items-center justify-center"
      >
        <VisuallyHidden>
          <FullscreenModalTitle>{title}</FullscreenModalTitle>
        </VisuallyHidden>

        {/* Header: título + botão fechar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 z-10">
          <span className="text-sm font-medium text-white/80 truncate max-w-[calc(100%-3rem)]">
            {title}
          </span>
          <FullscreenModalClose className="flex size-9 items-center justify-center rounded-md text-white opacity-80 transition-opacity hover:opacity-100 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/50">
            <X className="size-6" />
            <span className="sr-only">Fechar</span>
          </FullscreenModalClose>
        </div>

        {/* Vídeo */}
        <div className="w-full max-w-5xl px-4">
          <AspectRatio ratio={16 / 9}>
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </AspectRatio>
        </div>
      </FullscreenModalContent>
    </FullscreenModal>
  );
}
