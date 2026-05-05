import React, { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DEFAULT_ASPECT = 3; // 3:1
const DEFAULT_TARGET_WIDTH = 1280;
const DEFAULT_TARGET_HEIGHT = 427;

interface CoverCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  dialogTitle?: string;
  aspect?: number;
  targetWidth?: number;
  targetHeight?: number;
  dialogDescription?: string;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  targetWidth: number,
  targetHeight: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/webp",
      0.85,
    );
  });
}

export function CoverCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onConfirm,
  dialogTitle = "Recortar capa",
  aspect = DEFAULT_ASPECT,
  targetWidth = DEFAULT_TARGET_WIDTH,
  targetHeight = DEFAULT_TARGET_HEIGHT,
  dialogDescription = "Ajuste a área de recorte para o formato horizontal 3:1",
}: CoverCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [processing, setProcessing] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    imgRef.current = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }, [aspect]);

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !crop) return;

    setProcessing(true);
    try {
      const pixelCrop: PixelCrop = {
        unit: "px",
        x: (crop.unit === "%" ? (crop.x / 100) * imgRef.current.width : crop.x),
        y: (crop.unit === "%" ? (crop.y / 100) * imgRef.current.height : crop.y),
        width: (crop.unit === "%" ? (crop.width / 100) * imgRef.current.width : crop.width),
        height: (crop.unit === "%" ? (crop.height / 100) * imgRef.current.height : crop.height),
      };
      const blob = await getCroppedBlob(imgRef.current, pixelCrop, targetWidth, targetHeight);
      onConfirm(blob);
    } catch {
      console.error("Crop failed");
    } finally {
      setProcessing(false);
    }
  }, [crop, onConfirm, targetWidth, targetHeight]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        {imageSrc && (
          <div className="flex justify-center overflow-hidden rounded-md bg-muted">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              aspect={aspect}
              className="max-h-[60vh]"
            >
              <img
                src={imageSrc}
                onLoad={onImageLoad}
                alt="Recortar"
                className="max-h-[60vh] w-auto"
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!crop || processing}>
            {processing && <Loader2 className="size-4 animate-spin mr-2" />}
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
