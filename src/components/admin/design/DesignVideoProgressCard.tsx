import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DesignMarketingFormData {
  facebook_pixel_id: string | null;
  ga_tracking_id: string | null;
}

interface DesignVideoProgressCardProps {
  tenantId: string;
  plan: string;
  progressTrackingEnabled: boolean;
  onRefetch: () => void;
  formData: DesignMarketingFormData;
  onChange: (updates: Partial<DesignMarketingFormData>) => void;
}

export default function DesignVideoProgressCard({
  tenantId,
  plan,
  progressTrackingEnabled,
  onRefetch,
  formData,
  onChange,
}: DesignVideoProgressCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(progressTrackingEnabled);

  const isPro = plan === "pro" || plan === "business";

  const handleToggle = async (checked: boolean) => {
    if (!isPro) return;

    setIsToggling(true);
    setLocalEnabled(checked);

    try {
      const { error } = await supabase
        .from("tenant_settings")
        .update({ video_progress_tracking_enabled: checked })
        .eq("tenant_id", tenantId);

      if (error) throw error;

      toast.success(
        checked
          ? "Rastreamento de progresso ativado"
          : "Rastreamento de progresso desativado",
      );

      onRefetch();
    } catch (err) {
      setLocalEnabled(!checked);
      const msg =
        err instanceof Error ? err.message : "Erro ao alterar rastreamento de progresso";
      toast.error(msg);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card variant="bordered" className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Trackeamento</CardTitle>
          {!isPro && (
            <Badge variant="blue" className="ml-1 text-xs">
              Pro
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progresso por aluno */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Progresso por aluno</p>
            <p className="text-xs text-muted-foreground">
              Disponível no plano Pro. Registra automaticamente quantos segundos cada aluno assistiu em cada aula, marcando como concluída ao atingir 90% do vídeo.
            </p>
          </div>
          <Switch
            checked={localEnabled}
            onCheckedChange={handleToggle}
            disabled={!isPro || isToggling}
          />
        </div>

        {/* Facebook Pixel */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-pixel-id" className="text-sm font-medium">
            Facebook Pixel ID
          </Label>
          <Input
            id="fb-pixel-id"
            placeholder="Ex: 1234567890123456"
            value={formData.facebook_pixel_id ?? ""}
            onChange={(e) =>
              onChange({
                facebook_pixel_id: e.target.value.trim() || null,
              })
            }
            disabled={!isPro}
            className="text-sm"
          />
        </div>

        {/* Google Analytics */}
        <div className="space-y-1.5">
          <Label htmlFor="ga-tracking-id" className="text-sm font-medium">
            Google Analytics 4 — Tracking ID
          </Label>
          <Input
            id="ga-tracking-id"
            placeholder="Ex: G-XXXXXXXXXX"
            value={formData.ga_tracking_id ?? ""}
            onChange={(e) =>
              onChange({
                ga_tracking_id: e.target.value.trim() || null,
              })
            }
            disabled={!isPro}
            className="text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}
