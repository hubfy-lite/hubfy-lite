import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, ImageIcon, Loader2, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Field, FieldContent, FieldControl, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

interface ImageUploadFieldProps {
  label: string;
  description: string;
  value: string | null;
  aspect?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  userId: string;
  showcaseId: string;
  fieldKey: string;
}

function ImageUploadField({
  label,
  description,
  value,
  aspect = "aspect-video",
  onUpload,
  onRemove,
  userId,
  showcaseId,
  fieldKey,
}: ImageUploadFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("showcaseEdit.general.invalidImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("showcaseEdit.general.maxSize"));
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${userId}/showcase_${showcaseId}_${fieldKey}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      onUpload(`${urlData.publicUrl}?t=${Date.now()}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t("showcaseEdit.general.uploadError");
      toast.error(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div
        className={`relative w-full ${aspect} rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center cursor-pointer group`}
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="size-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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
                <span className="text-xs">{t("showcaseEdit.general.clickToUpload")}</span>
              </>
            )}
          </div>
        )}
      </div>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5 mr-1" />
          {t("common.remove")}
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
}

export interface ShowcaseFormData {
  title: string;
  slug: string;
  description: string;
  hero_url: string | null;
  bg_url: string | null;
  bg_dark_url: string | null;
  bg_light_url: string | null;
  logo_url: string | null;
  theme: string;
  grid_columns: number;
  cover_format: "horizontal";
}

interface ShowcaseGeneralSectionProps {
  form: ShowcaseFormData;
  onChange: (patch: Partial<ShowcaseFormData>) => void;
  userId: string;
  showcaseId: string;
  savedSlug?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")     // troca não-alfanuméricos por -
    .replace(/^-+|-+$/g, "")         // remove - do início/fim
    .replace(/-{2,}/g, "-");          // colapsa múltiplos -
}

export function ShowcaseGeneralSection({
  form,
  onChange,
  userId,
  showcaseId,
  savedSlug,
}: ShowcaseGeneralSectionProps) {
  const { t } = useTranslation();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const handleTitleChange = (value: string) => {
    const limitedTitle = limitNameLength(value);
    onChange({ title: limitedTitle });
    if (!slugManuallyEdited) {
      onChange({ title: limitedTitle, slug: slugify(limitedTitle) });
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    onChange({ slug: value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
  };

  const vitrineUrl = savedSlug ? `/showcases/${savedSlug}` : null;

  return (
    <div className="space-y-6">
      {/* Card 1: Informações */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("showcaseEdit.general.infoTitle")}</CardTitle>
          {vitrineUrl && (
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <a href={vitrineUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5 mr-1.5" />
                  {t("showcaseEdit.general.accessShowcase")}
                </a>
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Background */}
          <Field orientation="split">
            <FieldContent>
              <FieldLabel>{t("showcaseEdit.general.bgLabel")}</FieldLabel>
              <FieldDescription>
                {t("showcaseEdit.general.bgDescription")}
              </FieldDescription>
            </FieldContent>
            <FieldControl>
              <ImageUploadField
                label=""
                description=""
                value={form.bg_url}
                aspect="aspect-[3/1]"
                onUpload={(url) => onChange({ bg_url: url })}
                onRemove={() => onChange({ bg_url: null })}
                userId={userId}
                showcaseId={showcaseId}
                fieldKey="bg"
              />
            </FieldControl>
          </Field>

          <div className="border-t border-border" />

          {/* Título */}
          <Field orientation="split">
            <FieldContent>
              <FieldLabel>{t("showcaseEdit.general.titleLabel")}</FieldLabel>
              <FieldDescription>
                {t("showcaseEdit.general.titleDescription")}
              </FieldDescription>
            </FieldContent>
            <FieldControl>
              <Input
                id="sc-title"
                placeholder={t("showcaseEdit.general.titlePlaceholder")}
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                maxLength={FRONTEND_NAME_MAX_LENGTH}
              />
            </FieldControl>
          </Field>

          <div className="border-t border-border" />

          {/* Slug */}
          <Field orientation="split">
            <FieldContent>
              <FieldLabel>{t("showcaseEdit.general.slugLabel")}</FieldLabel>
              <FieldDescription>
                {t("showcaseEdit.general.slugDescription")}
              </FieldDescription>
            </FieldContent>
            <FieldControl>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl bg-muted text-foreground/80 text-sm border border-r-0 border-border whitespace-nowrap">
                  seudominio.com/
                </span>
                <Input
                  {...NO_AUTOFILL_PROPS}
                  id="sc-slug"
                  placeholder={t("showcaseEdit.general.slugPlaceholder")}
                  className="rounded-l-none"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                />
              </div>
            </FieldControl>
          </Field>

          <div className="border-t border-border" />

          {/* Descrição */}
          <Field orientation="split">
            <FieldContent>
              <FieldLabel>{t("showcaseEdit.general.descriptionLabel")}</FieldLabel>
              <FieldDescription>
                {t("showcaseEdit.general.descriptionDescription")}
              </FieldDescription>
            </FieldContent>
            <FieldControl>
              <Textarea
                {...NO_AUTOFILL_PROPS}
                id="sc-desc"
                placeholder={t("showcaseEdit.general.descriptionPlaceholder")}
                rows={6}
                value={form.description}
                onChange={(e) => onChange({ description: e.target.value })}
              />
            </FieldControl>
          </Field>

          <div className="border-t border-border" />

          {/* Logotipo */}
          <Field orientation="split">
            <FieldContent>
              <FieldLabel>{t("showcaseEdit.general.logoLabel")}</FieldLabel>
              <FieldDescription>
                {t("showcaseEdit.general.logoDescription")}
              </FieldDescription>
            </FieldContent>
            <FieldControl>
              <ImageUploadField
                label=""
                description=""
                value={form.logo_url}
                aspect="aspect-[3/1] max-h-24"
                onUpload={(url) => onChange({ logo_url: url })}
                onRemove={() => onChange({ logo_url: null })}
                userId={userId}
                showcaseId={showcaseId}
                fieldKey="logo"
              />
            </FieldControl>
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}
