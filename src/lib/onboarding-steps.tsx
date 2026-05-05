/**
 * Shared onboarding step components, constants, and helpers.
 * Used by AdminCompleteProfile (profile + workspace flow) and AdminNewWorkspace (workspace-only flow).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check, Circle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  OnboardingStep,
  OnboardingStepLeftWrapper,
  OnboardingStepRightWrapper,
  DashboardIllustration,
  FormField,
} from "@/components/onboarding1";
import type { StepComponentProps } from "@/components/onboarding1";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage, cn } from "@/lib/utils";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import {
  WORKSPACE_ICONS,
  WORKSPACE_ICON_MAP,
} from "@/lib/workspace-icons";

// ─── Flag component ───

export function Flag({ code, className }: { code: string; className?: string }) {
  return <span className={cn("fi fis rounded-sm", `fi-${code.toLowerCase()}`, className)} />;
}

// ─── Constants ───

export const COUNTRY_CODES = [
  { code: "+1", iso: "us" },
  { code: "+31", iso: "nl" },
  { code: "+32", iso: "be" },
  { code: "+33", iso: "fr" },
  { code: "+34", iso: "es" },
  { code: "+39", iso: "it" },
  { code: "+41", iso: "ch" },
  { code: "+43", iso: "at" },
  { code: "+44", iso: "gb" },
  { code: "+45", iso: "dk" },
  { code: "+46", iso: "se" },
  { code: "+47", iso: "no" },
  { code: "+48", iso: "pl" },
  { code: "+49", iso: "de" },
  { code: "+51", iso: "pe" },
  { code: "+52", iso: "mx" },
  { code: "+54", iso: "ar" },
  { code: "+55", iso: "br" },
  { code: "+56", iso: "cl" },
  { code: "+57", iso: "co" },
  { code: "+58", iso: "ve" },
  { code: "+91", iso: "in" },
  { code: "+351", iso: "pt" },
  { code: "+353", iso: "ie" },
  { code: "+358", iso: "fi" },
  { code: "+372", iso: "ee" },
  { code: "+591", iso: "bo" },
  { code: "+593", iso: "ec" },
  { code: "+595", iso: "py" },
  { code: "+598", iso: "uy" },
] as const;

export const COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "AU", name: "Austr\u00e1lia" },
  { code: "AT", name: "\u00c1ustria" },
  { code: "BE", name: "B\u00e9lgica" },
  { code: "BO", name: "Bol\u00edvia" },
  { code: "BR", name: "Brasil" },
  { code: "CA", name: "Canad\u00e1" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Col\u00f4mbia" },
  { code: "DK", name: "Dinamarca" },
  { code: "EC", name: "Equador" },
  { code: "ES", name: "Espanha" },
  { code: "EE", name: "Est\u00f4nia" },
  { code: "US", name: "Estados Unidos" },
  { code: "FI", name: "Finl\u00e2ndia" },
  { code: "FR", name: "Fran\u00e7a" },
  { code: "DE", name: "Alemanha" },
  { code: "NL", name: "Holanda" },
  { code: "IN", name: "\u00cdndia" },
  { code: "IE", name: "Irlanda" },
  { code: "IT", name: "It\u00e1lia" },
  { code: "MX", name: "M\u00e9xico" },
  { code: "NO", name: "Noruega" },
  { code: "PY", name: "Paraguai" },
  { code: "PE", name: "Peru" },
  { code: "PL", name: "Pol\u00f4nia" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Reino Unido" },
  { code: "SE", name: "Su\u00e9cia" },
  { code: "CH", name: "Su\u00ed\u00e7a" },
  { code: "UY", name: "Uruguai" },
  { code: "VE", name: "Venezuela" },
] as const;

export const USED_TOOLS = [
  "Hotmart", "Stripe", "Kiwify", "UTMfy", "PayPal", "Mercado Pago",
  "Zoom", "Vimeo", "Asaas", "Hubspot", "Guru",
  "Vturb", "Smart Player", "Panda Video", "Inlead", "Mailchimp",
  "ConvertKit", "Circle", "Discord", "Slack", "n8n", "Zapier",
  "Kajabi", "Curseduca", "Cademi", "MemberKit",
] as const;

// Shuffle tools once per module load so order feels random
const shuffledTools = [...USED_TOOLS].sort(() => Math.random() - 0.5);

export const ONBOARDING_GOALS = ["start_fresh", "migrate", "exploring"] as const;
export const CUSTOMER_COUNTS = ["over_5000", "1000_5000", "100_1000", "1_100", "none"] as const;
export const REVENUE_RANGES = ["over_10m", "1m_10m", "250k_1m", "100k_250k", "50k_100k", "under_50k"] as const;

export const ROLE_TAGS = [
  "Infoprodutor",
  "Coach",
  "Mentor",
  "Consultor",
  "Criador de conte\u00fado",
  "Professor",
  "Escola online",
  "Ag\u00eancia",
  "SaaS",
  "E-commerce",
  "Comunidade",
  "Podcast",
  "Outro",
] as const;

/** 22 cores em degradê: branco → amarelo → laranja → vermelho → magenta → violeta → roxo → azul → ciano → verde → cinza → preto */
export const WORKSPACE_COLORS = [
  "#FFFFFF",
  "#FDE68A",
  "#FDBA74",
  "#F97316",
  "#EF4444",
  "#F43F5E",
  "#EC4899",
  "#D946EF",
  "#A855F7",
  "#8B5CF6",
  "#6366F1",
  "#3B82F6",
  "#0EA5E9",
  "#06B6D4",
  "#14B8A6",
  "#10B981",
  "#22C55E",
  "#84CC16",
  "#A3A3A3",
  "#737373",
  "#404040",
  "#000000",
] as const;

export type WorkspaceColor = (typeof WORKSPACE_COLORS)[number];

// ─── Helpers ───

/** Returns "white" or "black" depending on which has more contrast against the given hex color.
 *  Uses the same BT.709 formula + 0.6 threshold as WorkspaceAvatar for consistency. */
export function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}

export function normalizeInstagram(value: string): string {
  return value.replace(/^@/, "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9._]/g, "").toLowerCase().slice(0, 30);
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function toSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

// ─── Step data interfaces ───

export interface WorkspaceStepData {
  wsName: string;
  slug: string;
  slugManuallyEdited: boolean;
  slugAvailable: boolean | null;
  checkingSlug: boolean;
  avatarMode: "icon" | "image";
  logoFile: File | null;
  logoBlobUrl: string | null;
  selectedIcon: string;
  selectedColor: WorkspaceColor;
  country: string;
  referralSource: string;
}

// ─── Skip button ───

export function SkipButton({ onSkip, label, description }: { onSkip: () => void; label: string; description: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="ghost">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("onboarding.skipConfirmTitle")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => { setOpen(false); onSkip(); }}>{t("onboarding.skipConfirmButton")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Icon picker dialog ───

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

/** Upload logo to Supabase Storage after tenant is created. Returns the public URL. */
export async function uploadLogoToStorage(file: File, tenantId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `workspace/${tenantId}/logo.${fileExt}`;
  const { error } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

// ═══════════════════════════════════════════
// Workspace Step (step 1 of workspace flow)
// Logo/icon, name, slug, color
// ═══════════════════════════════════════════

export function WorkspaceStep({
  onSubmit, goBack, currentStep, totalSteps, data, setData, submitting, excludeTenantId,
}: StepComponentProps & { data: WorkspaceStepData; setData: React.Dispatch<React.SetStateAction<WorkspaceStepData>>; submitting: boolean; excludeTenantId?: string | null }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slugCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data.slugManuallyEdited) setData((prev) => ({ ...prev, slug: toSlug(prev.wsName) }));
  }, [data.wsName, data.slugManuallyEdited, setData]);

  const checkSlugAvailability = useCallback((slugValue: string) => {
    if (slugCheckTimerRef.current) clearTimeout(slugCheckTimerRef.current);
    if (!slugValue || slugValue.length < 3) { setData((prev) => ({ ...prev, slugAvailable: null, checkingSlug: false })); return; }
    setData((prev) => ({ ...prev, checkingSlug: true }));
    slugCheckTimerRef.current = setTimeout(async () => {
      try {
        let query = supabase.from("tenants").select("id").eq("slug", slugValue);
        if (excludeTenantId) query = query.neq("id", excludeTenantId);
        const { data: existing, error } = await query.maybeSingle();
        if (error) throw error;
        setData((prev) => ({ ...prev, slugAvailable: !existing, checkingSlug: false }));
      } catch { setData((prev) => ({ ...prev, slugAvailable: null, checkingSlug: false })); }
    }, 400);
  }, [setData, excludeTenantId]);

  useEffect(() => { checkSlugAvailability(data.slug); return () => { if (slugCheckTimerRef.current) clearTimeout(slugCheckTimerRef.current); }; }, [data.slug, checkSlugAvailability]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ variant: "destructive", title: t("profile.avatar.invalidFile") }); return; }
    if (file.size > 2 * 1024 * 1024) { toast({ variant: "destructive", title: t("profile.avatar.fileTooLarge") }); return; }
    const blobUrl = URL.createObjectURL(file);
    setData((prev) => ({ ...prev, logoFile: file, logoBlobUrl: blobUrl, avatarMode: "image" }));
  };

  const handleRemoveLogo = () => {
    if (data.logoBlobUrl) URL.revokeObjectURL(data.logoBlobUrl);
    setData((prev) => ({ ...prev, logoFile: null, logoBlobUrl: null, avatarMode: "icon" }));
    // Reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleIconSelect = (iconName: string) => {
    if (data.logoBlobUrl) URL.revokeObjectURL(data.logoBlobUrl);
    setData((prev) => ({ ...prev, selectedIcon: iconName, avatarMode: "icon", logoFile: null, logoBlobUrl: null }));
  };

  const SelectedIcon = WORKSPACE_ICON_MAP[data.selectedIcon];
  const canFinish = data.wsName.trim().length >= 2 && data.slug.length >= 3 && data.slugAvailable === true;

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper title={t("newWorkspace.title")} currentStep={currentStep} totalSteps={totalSteps} goBack={goBack}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6 py-4">
          {/* Logo / Icon picker */}
          <div className="flex items-center gap-4">
            <div className="flex size-18 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border" style={data.logoBlobUrl ? undefined : { backgroundColor: data.selectedColor }} onClick={() => fileInputRef.current?.click()}>
              {data.logoBlobUrl ? (
                <img src={data.logoBlobUrl} alt="Logo" className="size-full object-cover" />
              ) : SelectedIcon ? (
                <SelectedIcon className="size-8" style={{ color: contrastColor(data.selectedColor) }} strokeWidth={1.5} />
              ) : (
                <Plus className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
                  {t("newWorkspace.uploadLogo")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("newWorkspace.or")}</span>
                <IconPickerDialog selectedIcon={data.selectedIcon} onSelect={handleIconSelect} />
              </div>
              {data.logoBlobUrl && (
                <Button variant="outline" size="sm" type="button" onClick={handleRemoveLogo}>
                  {t("common.remove")}
                </Button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
          </div>

          <div className="space-y-6 pt-4">
            <FormField label={t("newWorkspace.nameLabel")} placeholder={t("newWorkspace.namePlaceholder")} name="wsName" type="text" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData((prev) => ({ ...prev, wsName: e.target.value }))} />

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="ws-slug">{t("newWorkspace.slugLabel")}</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl bg-muted text-muted-foreground text-sm border border-r-0 border-border whitespace-nowrap">seudominio.com/</span>
                <div className="relative flex-1">
                  <Input {...NO_AUTOFILL_PROPS} id="ws-slug" className="rounded-l-none pr-10" placeholder={t("newWorkspace.slugPlaceholder")} value={data.slug} onChange={(e) => setData((prev) => ({ ...prev, slugManuallyEdited: true, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {data.checkingSlug && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    {!data.checkingSlug && data.slug.length >= 3 && data.slugAvailable === true && <span className="text-xs font-medium text-success">✓</span>}
                    {!data.checkingSlug && data.slug.length >= 3 && data.slugAvailable === false && <span className="text-xs font-medium text-destructive">✗</span>}
                  </div>
                </div>
              </div>
              {!data.checkingSlug && data.slug.length >= 3 && data.slugAvailable === false && <p className="text-xs text-destructive mt-1.5">{t("newWorkspace.slugTaken")}</p>}
            </div>

            {/* Color picker (always visible — used across the app) */}
            <div className="space-y-3">
                <Label>{t("newWorkspace.colorLabel")}</Label>
                <div className="flex flex-wrap gap-2">
                  {WORKSPACE_COLORS.map((color) => (
                    <button key={color} type="button" onClick={() => setData((prev) => ({ ...prev, selectedColor: color }))} className={cn("size-8 rounded-full transition-all flex items-center justify-center", data.selectedColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-110", color === "#FFFFFF" && "border border-border", color === "#000000" && "border border-border")} style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>
              </div>
          </div>
        </form>

        <Button type="button" onClick={() => canFinish && onSubmit()} className="mt-6 w-full" disabled={!canFinish || submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : t("completeProfile.continueButton")}
        </Button>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="bg-gradient-to-b from-background to-muted">
        <DashboardIllustration variant="zoomed-in" image={data.logoBlobUrl} iconName={data.avatarMode === "icon" ? data.selectedIcon : null} iconColor={data.avatarMode === "icon" ? data.selectedColor : null} title={data.wsName || "Workspace"} />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
}

// ═══════════════════════════════════════════
// Goal Step
// ═══════════════════════════════════════════

function RadioIndicator({ selected }: { selected: boolean }) {
  return selected
    ? <div className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"><div className="size-2.5 rounded-full bg-primary" /></div>
    : <Circle className="size-5 shrink-0 text-muted-foreground/40" />;
}

export function GoalStep({
  onSubmit, goBack, currentStep, totalSteps, selectedGoal, setSelectedGoal, data, setData,
}: StepComponentProps & {
  selectedGoal: string | null;
  setSelectedGoal: (v: string | null) => void;
  data: WorkspaceStepData;
  setData: React.Dispatch<React.SetStateAction<WorkspaceStepData>>;
}) {
  const { t } = useTranslation();

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper title={t("onboarding.goalTitle")} currentStep={currentStep} totalSteps={totalSteps} goBack={goBack} fixedWidth>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            {ONBOARDING_GOALS.map((goal) => (
              <div key={goal} role="button" onClick={() => setSelectedGoal(selectedGoal === goal ? null : goal)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-4 text-sm transition-colors", selectedGoal === goal ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                <RadioIndicator selected={selectedGoal === goal} />
                <span className="font-medium">{t(`onboarding.goal_${goal}`)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-6 space-y-2">
            <Label htmlFor="referralSource" className="text-lg font-semibold">{t("onboarding.referralLabel")}</Label>
            <Textarea id="referralSource" placeholder={t("onboarding.referralPlaceholder")} className="w-full" style={{ resize: "none" }} onChange={(e) => setData((prev) => ({ ...prev, referralSource: e.target.value }))} />
          </div>
        </div>

        <Button onClick={onSubmit} className="mt-6 w-full" disabled={!selectedGoal}>{t("completeProfile.continueButton")}</Button>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration variant="zoomed-in" image={data.logoBlobUrl} iconName={data.avatarMode === "icon" ? data.selectedIcon : null} iconColor={data.avatarMode === "icon" ? data.selectedColor : null} title={data.wsName || "Workspace"} />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
}

// ═══════════════════════════════════════════
// Customers Step
// ═══════════════════════════════════════════

export function CustomersStep({
  onSubmit, goBack, currentStep, totalSteps, selectedCount, setSelectedCount, data,
}: StepComponentProps & { selectedCount: string | null; setSelectedCount: (v: string | null) => void; data: WorkspaceStepData }) {
  const { t } = useTranslation();

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper title={t("onboarding.customersTitle")} currentStep={currentStep} totalSteps={totalSteps} goBack={goBack} fixedWidth>
        <div className="space-y-3 py-4">
          {CUSTOMER_COUNTS.map((count) => (
            <div key={count} role="button" onClick={() => setSelectedCount(selectedCount === count ? null : count)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-4 text-sm transition-colors", selectedCount === count ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
              <RadioIndicator selected={selectedCount === count} />
              <span className="font-medium">{t(`onboarding.customers_${count}`)}</span>
            </div>
          ))}
        </div>

        <Button onClick={onSubmit} className="mt-6 w-full" disabled={!selectedCount}>{t("completeProfile.continueButton")}</Button>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration variant="zoomed-in" image={data.logoBlobUrl} iconName={data.avatarMode === "icon" ? data.selectedIcon : null} iconColor={data.avatarMode === "icon" ? data.selectedColor : null} title={data.wsName || "Workspace"} />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
}

// ═══════════════════════════════════════════
// Revenue Step
// ═══════════════════════════════════════════

export function RevenueStep({
  onSubmit, goBack, currentStep, totalSteps, selectedRevenue, setSelectedRevenue, data,
}: StepComponentProps & { selectedRevenue: string | null; setSelectedRevenue: (v: string | null) => void; data: WorkspaceStepData }) {
  const { t } = useTranslation();

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper title={t("onboarding.revenueTitle")} currentStep={currentStep} totalSteps={totalSteps} goBack={goBack} fixedWidth>
        <div className="space-y-3 py-4">
          {REVENUE_RANGES.map((range) => (
            <div key={range} role="button" onClick={() => setSelectedRevenue(selectedRevenue === range ? null : range)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-4 text-sm transition-colors", selectedRevenue === range ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
              <RadioIndicator selected={selectedRevenue === range} />
              <span className="font-medium">{t(`onboarding.revenue_${range}`)}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">{t("onboarding.revenueCurrencyNote")}</p>
        </div>

        <Button onClick={onSubmit} className="mt-6 w-full" disabled={!selectedRevenue}>{t("completeProfile.continueButton")}</Button>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration variant="zoomed-in" image={data.logoBlobUrl} iconName={data.avatarMode === "icon" ? data.selectedIcon : null} iconColor={data.avatarMode === "icon" ? data.selectedColor : null} title={data.wsName || "Workspace"} />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
}

// ═══════════════════════════════════════════
// Tools Step
// ═══════════════════════════════════════════

export function GatewayStep({
  onSubmit, goBack, currentStep, totalSteps, selectedTools, setSelectedTools, data,
}: StepComponentProps & { selectedTools: string[]; setSelectedTools: (v: string[]) => void; data: WorkspaceStepData }) {
  const { t } = useTranslation();
  const toggleTool = (tool: string) => {
    setSelectedTools(selectedTools.includes(tool) ? selectedTools.filter((t) => t !== tool) : [...selectedTools, tool]);
  };

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper title={t("onboarding.gatewayTitle")} currentStep={currentStep} totalSteps={totalSteps} goBack={goBack} fixedWidth>
        <div className="space-y-6 py-4">
          <p className="text-sm">{t("onboarding.gatewayDescription")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {shuffledTools.map((tool) => (
              <div key={tool} role="button" className={cn("cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors", selectedTools.includes(tool) ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50")} onClick={() => toggleTool(tool)}>
                {tool}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={onSubmit} className="mt-6 w-full">{t("completeProfile.continueButton")}</Button>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration variant="zoomed-in" image={data.logoBlobUrl} iconName={data.avatarMode === "icon" ? data.selectedIcon : null} iconColor={data.avatarMode === "icon" ? data.selectedColor : null} title={data.wsName || "Workspace"} />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
}

// ═══════════════════════════════════════════
// Invite Step
// ═══════════════════════════════════════════

export function InviteStep({
  onSubmit, goBack, currentStep, totalSteps, tenantId,
}: StepComponentProps & { tenantId: string | null }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [emails, setEmails] = useState(["", ""]);
  const [sending, setSending] = useState(false);
  const validEmails = emails.filter((e) => e.includes("@") && e.includes("."));

  const handleSendInvites = async () => {
    if (!tenantId || validEmails.length === 0) return;
    setSending(true);

    // Client-side: filter out self-invites
    const currentEmail = user?.email?.toLowerCase();
    const selfEmails: string[] = [];
    const toInvite: string[] = [];
    for (const email of validEmails) {
      const normalized = email.trim().toLowerCase();
      if (currentEmail && normalized === currentEmail) {
        selfEmails.push(email);
      } else {
        toInvite.push(email);
      }
    }

    if (selfEmails.length > 0) {
      toast({ variant: "default", title: t("onboarding.selfInviteBlocked", "Você já faz parte deste workspace") });
    }

    // Send remaining invites with partial failure handling
    const failures: string[] = [];
    let successCount = 0;

    const results = await Promise.allSettled(
      toInvite.map(async (email) => {
        await invokeEdgeFunction("add-team-member", {
          body: { tenant_id: tenantId, email: email.trim(), role: "editor", origin: getPublicSiteUrl() },
        });
        return email;
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failures.push(result.reason?.message || t("onboarding.invitesError"));
      }
    }

    if (successCount > 0) {
      toast({ variant: "success", title: t("onboarding.invitesSent"), description: t("onboarding.invitesSentDesc") });
    }
    if (failures.length > 0) {
      toast({ variant: "destructive", title: t("common.error"), description: failures.join("; ") });
    }

    // Always finish onboarding — invites are optional
    setSending(false);
    onSubmit();
  };

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper title={t("onboarding.inviteTitle")} currentStep={currentStep} totalSteps={totalSteps} goBack={goBack} fixedWidth>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <p className="text-sm">{t("onboarding.inviteDescription1")}</p>
            <p className="text-sm">{t("onboarding.inviteDescription2")}</p>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <div className="space-y-4">
              <Label>{t("onboarding.inviteEmailLabel")}</Label>
              <div className="space-y-2">
                {emails.map((email, i) => (
                  <Input key={i} type="email" placeholder="nome@email.com" value={email}
                    onChange={(e) => {
                      const updated = [...emails];
                      updated[i] = e.target.value;
                      setEmails(updated);
                    }}
                  />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setEmails((prev) => [...prev, ""])}>
                  {t("onboarding.addMember")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Button type="submit" className="w-full" onClick={handleSendInvites} disabled={validEmails.length === 0 || sending}>
                {sending ? <Loader2 className="size-4 animate-spin" /> : t("onboarding.sendInvitesButton")}
              </Button>
              <SkipButton onSkip={onSubmit} label={t("onboarding.skipForNow")} description={t("onboarding.skipInviteDesc")} />
            </div>
          </form>
          <p className="text-xs text-muted-foreground">{t("onboarding.inviteFootnote")}</p>
        </div>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration transformOrigin="180% -10%" variant="zoomed-in" className="-translate-x-1/4 xl:-translate-x-1/5 2xl:translate-x-0" />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
}
