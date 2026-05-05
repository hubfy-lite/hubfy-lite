import { useRef, useState } from "react";
import { Upload, Loader2, Trash2, Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_ICONS,
  WORKSPACE_ICON_MAP,
  WORKSPACE_COLORS,
} from "@/lib/workspace-icons";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";

function IconPickerDialog({ selectedIcon, onSelect }: { selectedIcon: string; onSelect: (icon: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tempIcon, setTempIcon] = useState(selectedIcon);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setTempIcon(selectedIcon); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button">{t("newWorkspace.chooseIcon")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("newWorkspace.iconLabel")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5 p-0.5 max-h-[400px] overflow-y-auto">
          {WORKSPACE_ICONS.map((iconName) => {
            const Icon = WORKSPACE_ICON_MAP[iconName];
            if (!Icon) return null;
            return (
              <button key={iconName} type="button" onClick={() => setTempIcon(iconName)} className={cn("flex size-11 items-center justify-center rounded-lg transition-all", tempIcon === iconName ? "bg-muted ring-2 ring-primary" : "hover:bg-muted/50")} title={iconName}>
                <Icon className="size-5 text-foreground" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => { onSelect(tempIcon); setOpen(false); }}>{t("newWorkspace.selectIcon")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface DesignGeneralFormData {
  icon_url: string | null;
  icon_name: string | null;
  icon_color: string | null;
  primary_color: string;
  theme_mode: "light" | "dark";
  button_style: string;
}

interface DesignGeneralTabProps {
  formData: DesignGeneralFormData;
  onChange: (data: Partial<DesignGeneralFormData>) => void;
  onImageUpload: (file: File, field: "icon_url") => Promise<void>;
  onImageDelete: () => Promise<void>;
  uploadingIcon: boolean;
}

export default function DesignGeneralTab({
  formData,
  onChange,
  onImageUpload,
  onImageDelete,
  uploadingIcon,
}: DesignGeneralTabProps) {
  const { t } = useTranslation();
  const iconInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImageUpload(file, "icon_url");
    e.target.value = "";
  };

  const hasImage = !!formData.icon_url;

  return (
    <div className="space-y-6">
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("designPage.general.brandIdentity")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ── Avatar ── */}
          <div className="space-y-2">
            <div>
              <Label className="text-sm font-medium">Avatar</Label>
              <p className="text-xs text-muted-foreground">
                {t("designPage.general.iconDescription")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="size-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0 cursor-pointer group relative"
                onClick={() => iconInputRef.current?.click()}
              >
                {formData.icon_url ? (
                  <>
                    <img
                      src={formData.icon_url}
                      alt="Avatar"
                      className="size-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="size-4 text-white" />
                    </div>
                  </>
                ) : uploadingIcon ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <WorkspaceAvatar
                      iconName={formData.icon_name}
                      iconColor={formData.icon_color}
                      size="lg"
                      className="rounded-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <Upload className="size-4 text-white" />
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => iconInputRef.current?.click()}
                    disabled={uploadingIcon}
                  >
                    {uploadingIcon ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("designPage.general.uploading")}
                      </>
                    ) : (
                      t("newWorkspace.uploadLogo")
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">{t("newWorkspace.or")}</span>
                  <IconPickerDialog
                    selectedIcon={formData.icon_name ?? "Rocket"}
                    onSelect={(icon) => onChange({ icon_name: icon })}
                  />
                </div>
                {formData.icon_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onImageDelete()}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    {t("common.remove")}
                  </Button>
                )}
              </div>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── Paleta de cores ── */}
          <div className="space-y-3">
            <div>
              <Label>{t("designPage.general.avatarColorLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("designPage.general.avatarColorDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 p-0.5">
              {WORKSPACE_COLORS.map((color) => {
                const isSelected = formData.icon_color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onChange({ icon_color: color, primary_color: color })}
                    className={cn(
                      "size-8 rounded-full transition-all flex items-center justify-center",
                      isSelected
                        ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                        : "hover:scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                );
              })}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── Estilo (Dark/Light) ── */}
          <div className="space-y-2">
            <div>
              <Label>{t("designPage.general.styleLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("designPage.general.styleDescription")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onChange({ theme_mode: "light" })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                  formData.theme_mode === "light"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Sun className="size-4" />
                {t("common.light")}
              </button>
              <button
                type="button"
                onClick={() => onChange({ theme_mode: "dark" })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                  formData.theme_mode === "dark"
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

          {/* ── Botão (button style global) ── */}
          <div className="space-y-2">
            <div>
              <Label>{t("designPage.general.buttonStyleLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("designPage.general.buttonStyleDescription")}
              </p>
            </div>
            <Select
              value={formData.button_style}
              onValueChange={(value) => onChange({ button_style: value })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rectangular">{t("designPage.checkout.buttonStyleRectangular")}</SelectItem>
                <SelectItem value="rounded">{t("designPage.checkout.buttonStyleRounded")}</SelectItem>
                <SelectItem value="pill">{t("designPage.checkout.buttonStylePill")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
