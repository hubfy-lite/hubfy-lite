import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIProviders, type AIProviderKey } from "@/hooks/useAIProviders";
import {
  useAIGeneration,
  type AIFeature,
  type AIGenerationResult,
} from "@/hooks/useAIGeneration";
import {
  AI_LANGUAGES,
  getDefaultAILanguage,
  type AILanguageCode,
} from "@/lib/ai-languages";

const MAX_PROMPT_CHARS = 500;

interface AIGuidanceDialogProps<F extends AIFeature> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: F;
  /** Extra context passed to the edge function (e.g. current title on the form) */
  context?: Record<string, unknown>;
  onResult: (result: AIGenerationResult[F]) => void;
}

export function AIGuidanceDialog<F extends AIFeature>({
  open,
  onOpenChange,
  feature,
  context,
  onResult,
}: AIGuidanceDialogProps<F>) {
  const { t } = useTranslation();
  const { options, defaultOption, hasMultipleOptions } = useAIProviders();
  const { generate, isGenerating } = useAIGeneration<F>();

  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<AIProviderKey | null>(null);
  const [language, setLanguage] = useState<AILanguageCode>(getDefaultAILanguage());

  // Sync provider with default once providers load
  useEffect(() => {
    if (!provider && defaultOption) {
      setProvider(defaultOption.key);
    }
  }, [defaultOption, provider]);

  // Preserve prompt between openings (user-friendly for regenerating)
  // Only reset when dialog transitions from closed to open after a successful gen
  useEffect(() => {
    if (open && !provider && defaultOption) {
      setProvider(defaultOption.key);
    }
  }, [open, defaultOption, provider]);

  const canSubmit = !!provider && prompt.trim().length > 0 && !isGenerating;

  async function handleGenerate() {
    if (!canSubmit || !provider) return;
    try {
      const result = await generate({
        feature,
        input: {
          user_input: prompt.trim(),
          ...(context ?? {}),
        },
        provider,
        language,
      } as Parameters<typeof generate>[0]);

      onResult(result);
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {t("aiGen.dialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("aiGen.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("aiGen.dialog.provider")}
            </label>
            <Select
              value={provider ?? ""}
              onValueChange={(v) => setProvider(v as AIProviderKey)}
              disabled={!hasMultipleOptions}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("aiGen.dialog.providerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    <span className="flex items-center gap-2">
                      {opt.logo && (
                        <img
                          src={opt.logo}
                          alt=""
                          className="size-4 rounded-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      {opt.label}
                      {opt.key === "hubfy" && (
                        <span className="text-xs text-muted-foreground">
                          {t("aiGen.dialog.defaultBadge")}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("aiGen.dialog.language")}
            </label>
            <Select value={language} onValueChange={(v) => setLanguage(v as AILanguageCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {t(lang.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("aiGen.dialog.prompt")}
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
              placeholder={t("aiGen.dialog.promptPlaceholder")}
              rows={4}
              maxLength={MAX_PROMPT_CHARS}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">
              {prompt.length}/{MAX_PROMPT_CHARS}
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!canSubmit}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("aiGen.dialog.generating")}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {t("aiGen.dialog.generate")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
