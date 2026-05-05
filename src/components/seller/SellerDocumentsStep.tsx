import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ImageIcon, CheckCircle2, Loader2, Info, Camera, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Seller, SellerDocumentCategory, IdentityDocType } from "@/types/seller";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/bmp",
  "image/webp",
  "image/heic",
  "image/heif",
];

/* ── Document combination config ── */

interface DocSlot {
  category: SellerDocumentCategory;
  labelKey: string;
  icon: "camera" | "image" | "file";
}

const DOC_COMBOS: Record<IdentityDocType, { labelKey: string; hintKey: string; slots: DocSlot[] }> = {
  selfie_cnh_full: {
    labelKey: "seller.steps.documents.combo.selfieCnhFull",
    hintKey: "seller.steps.documents.combo.selfieCnhFullHint",
    slots: [
      { category: "selfie", labelKey: "seller.steps.documents.slot.selfie", icon: "camera" },
      { category: "cnh_full", labelKey: "seller.steps.documents.slot.cnhFull", icon: "file" },
    ],
  },
  selfie_cnh_front_back: {
    labelKey: "seller.steps.documents.combo.selfieCnhFrontBack",
    hintKey: "seller.steps.documents.combo.selfieCnhFrontBackHint",
    slots: [
      { category: "selfie", labelKey: "seller.steps.documents.slot.selfie", icon: "camera" },
      { category: "cnh_front", labelKey: "seller.steps.documents.slot.cnhFront", icon: "image" },
      { category: "cnh_back", labelKey: "seller.steps.documents.slot.cnhBack", icon: "image" },
    ],
  },
  selfie_rg_front_back: {
    labelKey: "seller.steps.documents.combo.selfieRgFrontBack",
    hintKey: "seller.steps.documents.combo.selfieRgFrontBackHint",
    slots: [
      { category: "selfie", labelKey: "seller.steps.documents.slot.selfie", icon: "camera" },
      { category: "rg_front", labelKey: "seller.steps.documents.slot.rgFront", icon: "image" },
      { category: "rg_back", labelKey: "seller.steps.documents.slot.rgBack", icon: "image" },
    ],
  },
};

const COMBO_OPTIONS: IdentityDocType[] = [
  "selfie_cnh_full",
  "selfie_cnh_front_back",
  "selfie_rg_front_back",
];

/* ── Main component ── */

interface SellerDocumentsStepProps {
  seller: Seller;
  onUpload: (category: SellerDocumentCategory, file: File, identitySubType?: "front" | "back" | "full") => Promise<void>;
  onSave: (data: Record<string, unknown>) => Promise<unknown>;
  onRemoveDocument: (documentId: string) => Promise<void>;
  onNext: () => void;
}

export function SellerDocumentsStep({
  seller,
  onUpload,
  onSave,
  onRemoveDocument,
  onNext,
}: SellerDocumentsStepProps) {
  const { t } = useTranslation();
  const docs = seller.seller_documents ?? [];

  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selectedCombo, setSelectedCombo] = useState<IdentityDocType | "">(seller.identity_doc_type ?? "");

  const activeCombo = selectedCombo ? DOC_COMBOS[selectedCombo] : null;

  const getDocForCategory = (category: SellerDocumentCategory) =>
    docs.find((d) => d.category === category);

  // Check which combos are fully complete (all required docs uploaded)
  const isComboComplete = (combo: IdentityDocType) => {
    const slots = DOC_COMBOS[combo].slots;
    return slots.every((slot) => getDocForCategory(slot.category));
  };

  // A combo is "locked" (muted) when ANOTHER combo is fully complete
  const completedCombo = COMBO_OPTIONS.find((c) => isComboComplete(c));
  const isComboLocked = (combo: IdentityDocType) =>
    completedCombo !== undefined && completedCombo !== combo;

  const handleComboSelect = async (combo: IdentityDocType) => {
    setSelectedCombo(combo);
    try {
      await onSave({ identity_doc_type: combo });
    } catch {
      // silent — best-effort save
    }
  };

  const handleUpload = async (category: SellerDocumentCategory, file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("seller.errors.invalidFileType"));
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error(t("seller.errors.fileTooLarge"));
      return;
    }

    setUploading(category);
    try {
      await onUpload(category, file);
      toast.success(t("seller.documentUploaded"));
    } catch (err: any) {
      toast.error(err.message || t("seller.errors.uploadFailed"));
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (documentId: string) => {
    try {
      await onRemoveDocument(documentId);
      toast.success(t("seller.documentRemoved"));
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    }
  };

  const handleDrop = (e: React.DragEvent, category: SellerDocumentCategory) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(category, file);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOver(id);
  };

  const handleDragLeave = () => setDragOver(null);

  const slotIcon = (type: DocSlot["icon"]) => {
    switch (type) {
      case "camera": return <Camera className="size-8 text-muted-foreground/60" />;
      case "file": return <FileText className="size-8 text-muted-foreground/60" />;
      default: return <ImageIcon className="size-8 text-muted-foreground/60" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-normal text-foreground md:text-xl">
          {t("seller.steps.documents.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("seller.steps.documents.description")}
        </p>
      </div>

      {/* Callout */}
      <div className="rounded-lg bg-muted/60 p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("seller.steps.documents.identityGuidelines")}
          </p>
        </div>
      </div>

      {/* ── Combo selector ── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          {t("seller.steps.documents.comboTitle")}
        </h3>

        <div className="space-y-2">
          {COMBO_OPTIONS.map((combo) => {
            const config = DOC_COMBOS[combo];
            const isSelected = selectedCombo === combo;
            const locked = isComboLocked(combo);
            const complete = isComboComplete(combo);

            return (
              <button
                key={combo}
                type="button"
                onClick={() => !locked && handleComboSelect(combo)}
                disabled={locked}
                className={cn(
                  "w-full rounded-xl border-2 px-4 py-3.5 text-left transition-colors",
                  locked
                    ? "cursor-not-allowed border-border/50 bg-muted/40 opacity-50"
                    : isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                )}
              >
                <span className={cn(
                  "text-sm font-medium",
                  locked
                    ? "text-muted-foreground"
                    : isSelected
                      ? "text-primary"
                      : "text-foreground"
                )}>
                  {t(config.labelKey)}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({t(config.hintKey)})
                </span>
                {complete && (
                  <CheckCircle2 className="ml-2 inline-block size-4 text-success-text" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Upload slots ── */}
      {activeCombo && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-foreground">
            {t("seller.steps.documents.uploadTitle")}
          </h3>

          {activeCombo.slots.map((slot) => {
            const existingDoc = getDocForCategory(slot.category);
            const isUploading = uploading === slot.category;

            return (
              <div key={slot.category} className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {t(slot.labelKey)}
                </p>

                {isUploading ? (
                  <UploadLoading />
                ) : existingDoc ? (
                  <UploadedFile
                    filename={existingDoc.original_filename}
                    onRemove={() => handleRemove(existingDoc.id)}
                  />
                ) : (
                  <DropZone
                    id={slot.category}
                    icon={slotIcon(slot.icon)}
                    label={t("seller.steps.documents.clickOrDrag")}
                    hint="JPG, PNG, WebP • 5MB"
                    dragOver={dragOver === slot.category}
                    onDrop={(e) => handleDrop(e, slot.category)}
                    onDragOver={(e) => handleDragOver(e, slot.category)}
                    onDragLeave={handleDragLeave}
                    onFileSelect={(file) => handleUpload(slot.category, file)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4">
        <Button className="w-full" onClick={onNext}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}

/* ── Drop Zone Component ── */

function DropZone({
  id,
  icon,
  label,
  hint,
  dragOver,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  dragOver: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onFileSelect: (file: File) => void;
}) {
  const accept = ALLOWED_TYPES.join(",");

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {icon}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/* ── Uploaded File Card ── */

function UploadedFile({
  filename,
  onRemove,
}: {
  filename: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-success-border bg-success-bg p-3">
      <div className="flex items-center gap-3 min-w-0">
        <CheckCircle2 className="size-5 shrink-0 text-success-text" />
        <span className="text-sm font-medium truncate">{filename}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 size-8"
        onClick={onRemove}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

/* ── Loading State ── */

function UploadLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
      <Loader2 className="size-5 animate-spin text-blue-600" />
      <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
    </div>
  );
}
