import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VideoSettings } from "@/lib/video-settings";
import ColorPalette from "./ColorPalette";

export type DesignVideoPlayerFormData = VideoSettings;

interface DesignVideoPlayerTabProps {
  formData: DesignVideoPlayerFormData;
  fallbackColor: string;
  plan: string;
  onChange: (data: Partial<DesignVideoPlayerFormData>) => void;
}

function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function DesignVideoPlayerTab({
  formData,
  fallbackColor,
  plan,
  onChange,
}: DesignVideoPlayerTabProps) {
  const { t } = useTranslation();
  const isPro = plan === "pro" || plan === "business";
  const safeFallbackColor = isHexColor(fallbackColor) ? fallbackColor : "#6366f1";
  const effectivePlayerColor = isHexColor(formData.player.player_color)
    ? formData.player.player_color
    : safeFallbackColor;

  const updatePlayer = (updates: Partial<DesignVideoPlayerFormData["player"]>) => {
    onChange({
      player: {
        ...formData.player,
        ...updates,
        powered_by_gumlet_overlay: false,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("designPage.videoPlayer.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div>
              <Label>{t("designPage.videoPlayer.colorLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("designPage.videoPlayer.colorDescription")}
              </p>
            </div>
            <ColorPalette
              value={effectivePlayerColor}
              onChange={(color) => updatePlayer({ player_color: color })}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updatePlayer({ player_color: null })}
              disabled={!formData.player.player_color}
            >
              {t("designPage.videoPlayer.useTenantColor")}
            </Button>
          </div>

          <div className="border-t border-border" />

          <ToggleField
            label={t("designPage.videoPlayer.preloadLabel")}
            description={t("designPage.videoPlayer.preloadDescription")}
            checked={formData.player.preload}
            onCheckedChange={(checked) => updatePlayer({ preload: checked })}
          />

          <div className="border-t border-border" />

          <ToggleField
            label={t("designPage.videoPlayer.autoplayLabel")}
            description={t("designPage.videoPlayer.autoplayDescription")}
            checked={formData.player.autoplay}
            onCheckedChange={(checked) => updatePlayer({ autoplay: checked })}
          />

          <div className="border-t border-border" />

          <ToggleField
            label={t("designPage.videoPlayer.loopLabel")}
            description={t("designPage.videoPlayer.loopDescription")}
            checked={formData.player.loop}
            onCheckedChange={(checked) => updatePlayer({ loop: checked })}
          />

          <div className="border-t border-border" />

          <ToggleField
            label={t("designPage.videoPlayer.seekLabel")}
            description={t("designPage.videoPlayer.seekDescription")}
            checked={formData.player.seek_enabled}
            onCheckedChange={(checked) => updatePlayer({ seek_enabled: checked })}
          />

          <div className="border-t border-border" />

          <ToggleField
            label={t("designPage.videoPlayer.controlsLabel")}
            description={t("designPage.videoPlayer.controlsDescription")}
            checked={formData.player.controls_visible}
            onCheckedChange={(checked) => updatePlayer({ controls_visible: checked })}
          />

        </CardContent>
      </Card>

      {/* AI card — caption generation + display, both Pro-gated */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("designPage.videoPlayer.aiCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className={cn("text-sm font-medium", !isPro && "text-muted-foreground")}>
                  {t("designPage.videoPlayer.captionsGenerateLabel")}
                </Label>
                <Badge variant="blue" className="text-xs">Pro</Badge>
              </div>
              <p className={cn("text-xs text-muted-foreground", !isPro && "opacity-60")}>
                {t("designPage.videoPlayer.captionsGenerateDescription")}
              </p>
            </div>
            <Switch
              checked={isPro ? formData.player.captions_generate_auto : false}
              onCheckedChange={(checked) => updatePlayer({ captions_generate_auto: checked })}
              disabled={!isPro}
            />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className={cn("text-sm font-medium", !isPro && "text-muted-foreground")}>
                  {t("designPage.videoPlayer.captionsDisplayLabel")}
                </Label>
                <Badge variant="blue" className="text-xs">Pro</Badge>
              </div>
              <p className={cn("text-xs text-muted-foreground", !isPro && "opacity-60")}>
                {t("designPage.videoPlayer.captionsDisplayDescription")}
              </p>
            </div>
            <Switch
              checked={isPro ? formData.player.captions_auto : false}
              onCheckedChange={(checked) => updatePlayer({ captions_auto: checked })}
              disabled={!isPro}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
