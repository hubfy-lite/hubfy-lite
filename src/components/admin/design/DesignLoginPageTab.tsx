import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon, ImageIcon, Upload, Search, X, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isUnsplashConfigured } from "@/lib/unsplash";
import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";
import ColorPalette from "./ColorPalette";

export interface DesignLoginPageFormData {
  portal_use_brand_colors: boolean;
  portal_theme_mode: "light" | "dark";
  portal_bg_image_url: string | null;
  portal_button_color: string;
  portal_button_style: string;
}

interface DesignLoginPageTabProps {
  formData: DesignLoginPageFormData;
  brandColor: string;
  generalThemeMode: "light" | "dark";
  onChange: (data: Partial<DesignLoginPageFormData>) => void;
  onBgImageUpload: (file: File) => Promise<void>;
  uploadingBgImage: boolean;
}

export default function DesignLoginPageTab({
  formData,
  brandColor,
  generalThemeMode,
  onChange,
  onBgImageUpload,
  uploadingBgImage,
}: DesignLoginPageTabProps) {
  const { t } = useTranslation();
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [unsplashOpen, setUnsplashOpen] = useState(false);

  const useBrand = formData.portal_use_brand_colors;
  const effectiveButton = useBrand ? brandColor : formData.portal_button_color;
  const effectiveTheme = useBrand ? generalThemeMode : formData.portal_theme_mode;

  return (
    <div className="space-y-6">
      {/* ── Identidade da marca ── */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("designPage.loginPage.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Use brand style switch */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("designPage.loginPage.useBrandLabel")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("designPage.loginPage.useBrandDescription")}
              </p>
            </div>
            <Switch
              checked={useBrand}
              onCheckedChange={(checked) =>
                onChange({ portal_use_brand_colors: checked })
              }
            />
          </div>

          <div className="border-t border-border" />

          {/* Theme mode (Light / Dark) */}
          <div className={cn("space-y-2 transition-opacity", useBrand && "opacity-50 pointer-events-none")}>
            <div>
              <Label>{t("designPage.loginPage.themeLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {useBrand
                  ? t("designPage.loginPage.themeFollowsGeneral")
                  : t("designPage.loginPage.themeDescription")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => !useBrand && onChange({ portal_theme_mode: "light" })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                  effectiveTheme === "light"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Sun className="size-4" />
                {t("common.light")}
              </button>
              <button
                type="button"
                onClick={() => !useBrand && onChange({ portal_theme_mode: "dark" })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                  effectiveTheme === "dark"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Moon className="size-4" />
                {t("common.dark")}
              </button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Button color */}
          <div className={cn("space-y-3 transition-opacity", useBrand && "opacity-50 pointer-events-none")}>
            <div>
              <Label>{t("designPage.loginPage.buttonLabel")}</Label>
            </div>
            <ColorPalette
              value={effectiveButton}
              onChange={(color) => onChange({ portal_button_color: color })}
            />
          </div>

          <div className="border-t border-border" />

          {/* Button style */}
          <div className={cn("space-y-2 transition-opacity", useBrand && "opacity-50 pointer-events-none")}>
            <div>
              <Label>{t("designPage.loginPage.buttonStyleLabel")}</Label>
            </div>
            <Select
              value={formData.portal_button_style}
              onValueChange={(value) =>
                !useBrand && onChange({ portal_button_style: value })
              }
              disabled={useBrand}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rectangular">
                  {t("designPage.checkout.buttonStyleRectangular")}
                </SelectItem>
                <SelectItem value="rounded">
                  {t("designPage.checkout.buttonStyleRounded")}
                </SelectItem>
                <SelectItem value="pill">
                  {t("designPage.checkout.buttonStylePill")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Imagem de fundo ── */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("designPage.loginPage.bgImageLabel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("designPage.loginPage.bgImageDescription")}
            </p>
            <div className="flex items-center gap-3">
              {formData.portal_bg_image_url ? (
                <div className="relative group">
                  <img
                    src={formData.portal_bg_image_url}
                    alt={t("designPage.loginPage.bgImageLabel")}
                    className="w-20 h-14 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ portal_bg_image_url: null })}
                    className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-14 rounded-lg border border-dashed border-border bg-muted/50 flex items-center justify-center">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bgInputRef.current?.click()}
                  disabled={uploadingBgImage}
                >
                  {uploadingBgImage ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      {t("designPage.general.uploading")}
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" />
                      {t("designPage.general.upload")}
                    </>
                  )}
                </Button>
                {isUnsplashConfigured() && (
                  <>
                    <span className="text-xs text-muted-foreground">{t("newWorkspace.or")}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnsplashOpen(true)}
                    >
                      <Search className="size-3.5" />
                      {t("unsplash.searchButton")}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onBgImageUpload(file);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      <UnsplashPickerDialog
        open={unsplashOpen}
        onOpenChange={setUnsplashOpen}
        onSelect={(blob) => {
          const file = new File([blob], "unsplash-bg.jpg", { type: blob.type });
          onBgImageUpload(file);
          setUnsplashOpen(false);
        }}
        defaultQuery="office"
      />
    </div>
  );
}
