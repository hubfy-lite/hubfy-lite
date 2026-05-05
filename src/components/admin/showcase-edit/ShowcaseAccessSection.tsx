import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateAppError } from "@/lib/app-error-utils";

interface ShowcaseAccessSectionProps {
  showcaseId: string;
  form: {
    hero_url: string | null;
  };
  onChange: (patch: { hero_url: string | null }) => void;
  userId: string;
}

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
      toast.error(t("showcase.invalidImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("showcase.maxFileSize"));
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
    } catch (error: unknown) {
      toast.error(translateAppError(error, "Erro ao enviar imagem"));
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
                <span className="text-xs">Clique para enviar</span>
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
          Remover
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
}

export function ShowcaseAccessSection({ showcaseId, form, onChange, userId }: ShowcaseAccessSectionProps) {
  return (
    <div className="space-y-6">
      {/* Card 1: Hero */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Hero</CardTitle>
          <CardDescription>Imagem de fundo da página pública de entrada da comunidade (pré-login)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {/* Left: future toggles */}
            <div className="w-1/2 space-y-3">
              <p className="text-sm text-muted-foreground">
                Em breve: opções de personalização da hero, como título sobreposto, gradiente, posição do texto e call-to-action. Estas configurações permitirão controlar a aparência da página de entrada da sua comunidade.
              </p>
            </div>
            {/* Right: image upload */}
            <div className="w-1/2">
              <ImageUploadField
                label="Imagem de fundo"
                description="Recomendado: 1920×1080 ou superior"
                value={form.hero_url}
                aspect="aspect-video"
                onUpload={(url) => onChange({ hero_url: url })}
                onRemove={() => onChange({ hero_url: null })}
                userId={userId}
                showcaseId={showcaseId}
                fieldKey="hero"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Controle de Acesso (placeholder) */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Controle de Acesso</CardTitle>
          <CardDescription>
            Defina quem pode acessar esta vitrine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
            <p>Em breve — controle de visibilidade e clientes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
