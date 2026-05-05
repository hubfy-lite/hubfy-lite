import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIGuidanceDialog } from "./AIGuidanceDialog";
import type { AIFeature, AIGenerationResult } from "@/hooks/useAIGeneration";

interface AIGenerateButtonProps<F extends AIFeature> {
  feature: F;
  /** Extra context merged into the input sent to the edge function */
  context?: Record<string, unknown>;
  onResult: (result: AIGenerationResult[F]) => void;
  size?: "sm" | "xs" | "default";
  variant?: "outline" | "default" | "ghost";
}

export function AIGenerateButton<F extends AIFeature>({
  feature,
  context,
  onResult,
  size = "sm",
  variant = "outline",
}: AIGenerateButtonProps<F>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-3.5" />
        {t("aiGen.button")}
      </Button>

      <AIGuidanceDialog
        open={open}
        onOpenChange={setOpen}
        feature={feature}
        context={context}
        onResult={onResult}
      />
    </>
  );
}
