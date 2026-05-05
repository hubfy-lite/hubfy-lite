import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OnboardingStep,
  OnboardingStepLeftWrapper,
  OnboardingStepRightWrapper,
  DashboardIllustration,
  FileInput,
} from "@/components/onboarding1";
import type { StepComponentProps } from "@/components/onboarding1";
import i18n from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { translateAppError } from "@/lib/app-error-utils";
import { ThemeSwitcher } from "@/components/auth/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { WORKSPACE_ICONS } from "@/lib/workspace-icons";
import { BRAND_NAME, BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "@/lib/brand";
import {
  COUNTRY_CODES,
  Flag,
  normalizeInstagram,
  onlyDigits,
  WorkspaceStep,
  GoalStep,
  CustomersStep,
  RevenueStep,
  GatewayStep,
  InviteStep,
  uploadLogoToStorage,
  WORKSPACE_COLORS,
  type WorkspaceStepData,
} from "@/lib/onboarding-steps";

// ─── Profile step data ───

interface ProfileStepData {
  avatarUrl: string | null;
  name: string;
  countryCode: string;
  phoneNumber: string;
  instagram: string;
}

// ─── Step 1: Profile ───

function ProfileStep({
  onSubmit,
  currentStep,
  totalSteps,
  data,
  setData,
}: StepComponentProps & {
  data: ProfileStepData;
  setData: React.Dispatch<React.SetStateAction<ProfileStepData>>;
}) {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const canSubmit = data.phoneNumber.length >= 8 && data.phoneNumber.length <= 15 && data.name.trim().length >= 2 && data.instagram.length >= 2;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: t("profile.avatar.invalidFile"), description: t("profile.avatar.invalidFileDescription") });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: t("profile.avatar.fileTooLarge"), description: t("profile.avatar.fileTooLargeDescription") });
      return;
    }
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const profileId = profile?.id || user.id;
      const fileName = `${user.id}/${profileId}_avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = newAvatarUrl;
        setTimeout(() => resolve(), 3000);
      });
      const { data: updated, error: updateError } = await supabase.from("profiles").update({ avatar_url: newAvatarUrl }).eq("user_id", user.id).select().single();
      if (updateError) throw updateError;
      const finalUrl = updated?.avatar_url ?? newAvatarUrl;
      setData((prev) => ({ ...prev, avatarUrl: finalUrl }));
      updateProfile({ avatar_url: finalUrl });
    } catch (error: unknown) {
      console.error("Error uploading avatar:", error);
      toast({ variant: "destructive", title: t("profile.avatar.uploadError"), description: translateAppError(error, t("profile.avatar.uploadErrorDescription")) });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user) return;
    setData((prev) => ({ ...prev, avatarUrl: null }));
    await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
    updateProfile({ avatar_url: null });
  };

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper title={t("completeProfile.title")} currentStep={currentStep} totalSteps={totalSteps}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6 py-4">
          <FileInput
            label={t("completeProfile.photoLabel")}
            name="profilePicture"
            onChange={handleFileUpload}
            onRemove={handleRemoveImage}
            value={uploading ? null : data.avatarUrl}
            description={t("completeProfile.photoDescription")}
          />
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="cp-name">{t("profile.info.nameLabel")}</Label>
              <Input id="cp-name" placeholder={t("profile.info.namePlaceholder")} value={data.name} onChange={(e) => setData((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("completeProfile.whatsappLabel")}</Label>
              <div className="flex gap-2">
                <Select value={data.countryCode} onValueChange={(v) => setData((prev) => ({ ...prev, countryCode: v }))}>
                  <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.iso} value={`${c.code}:${c.iso}`}>
                        <span className="flex items-center gap-1.5"><Flag code={c.iso} className="size-4" /><span className="text-muted-foreground">{c.code}</span></span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="tel" inputMode="numeric" placeholder={t("completeProfile.whatsappPlaceholder")} value={data.phoneNumber} onChange={(e) => setData((prev) => ({ ...prev, phoneNumber: onlyDigits(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-instagram">{t("completeProfile.instagramLabel")}</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl bg-muted text-muted-foreground text-sm border border-r-0 border-border">@</span>
                <Input id="cp-instagram" className="rounded-l-none" placeholder={t("completeProfile.instagramPlaceholder")} value={data.instagram} onChange={(e) => setData((prev) => ({ ...prev, instagram: normalizeInstagram(e.target.value) }))} />
              </div>
            </div>
          </div>
        </form>

        <Button type="button" onClick={() => canSubmit && onSubmit()} className="mt-6 w-full" disabled={!canSubmit}>
          {t("completeProfile.continueButton")}
        </Button>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
}

// ─── Main page ───

export default function AdminCompleteProfile() {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const { workspaces } = useUserWorkspaces();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const needsWorkspace = workspaces.length === 0;
  const STEPS = needsWorkspace
    ? ["profile", "workspace", "goal", "customers", "revenue", "gateway", "invite"] as const
    : ["profile"] as const;
  const totalSteps = STEPS.length;

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<ProfileStepData>({
    avatarUrl: profile?.avatar_url || null,
    name: profile?.name || "",
    countryCode: i18n.language === "pt-BR" ? "+55:br" : "+1:us",
    phoneNumber: "",
    instagram: "",
  });

  const [wsData, setWsData] = useState<WorkspaceStepData>({
    wsName: "",
    slug: "",
    slugManuallyEdited: false,
    slugAvailable: null,
    checkingSlug: false,
    avatarMode: "icon",
    logoFile: null,
    logoBlobUrl: null,
    selectedIcon: WORKSPACE_ICONS[0],
    selectedColor: WORKSPACE_COLORS[10],
    country: i18n.language === "pt-BR" ? "BR" : "US",
    referralSource: "",
  });

  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedCustomerCount, setSelectedCustomerCount] = useState<string | null>(null);
  const [selectedRevenue, setSelectedRevenue] = useState<string | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const currentStepName = STEPS[currentStep];

  const saveProfile = async () => {
    if (!user) return;
    const [dialCode] = profileData.countryCode.split(":");
    const whatsapp = `${dialCode}${profileData.phoneNumber}`;
    const normalizedIg = profileData.instagram ? normalizeInstagram(profileData.instagram) : null;
    const { error } = await supabase.from("profiles").update({ name: profileData.name.trim(), whatsapp, instagram: normalizedIg }).eq("user_id", user.id);
    if (error) throw error;
    updateProfile({ name: profileData.name.trim(), whatsapp, instagram: normalizedIg });
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
  };

  const createWorkspace = async (): Promise<string | null> => {
    if (!user) return null;

    // Idempotent: if we already created a tenant in this session, update it instead
    if (createdTenantId) {
      await supabase.from("tenants").update({ name: wsData.wsName.trim(), slug: wsData.slug }).eq("id", createdTenantId);

      const settingsUpdate: Record<string, unknown> = {};
      if (wsData.avatarMode === "image" && wsData.logoFile) {
        const logoUrl = await uploadLogoToStorage(wsData.logoFile, createdTenantId);
        settingsUpdate.icon_url = logoUrl;
        settingsUpdate.icon_name = null;
        settingsUpdate.icon_color = null;
      } else {
        settingsUpdate.icon_name = wsData.selectedIcon;
        settingsUpdate.icon_color = wsData.selectedColor;
        settingsUpdate.icon_url = null;
      }
      await supabase.from("tenant_settings").update(settingsUpdate).eq("tenant_id", createdTenantId);
      return createdTenantId;
    }

    const { data: newTenant, error } = await supabase.from("tenants").insert({ name: wsData.wsName.trim(), slug: wsData.slug, created_by: user.id }).select("id").single();
    if (error) {
      if (error.message?.includes("unique") || error.message?.includes("duplicate") || error.code === "23505") {
        setWsData((prev) => ({ ...prev, slugAvailable: false }));
        setCurrentStep(STEPS.indexOf("workspace" as typeof STEPS[number]));
        toast({ variant: "destructive", title: t("newWorkspace.slugUnavailable"), description: t("newWorkspace.slugUnavailableDesc") });
        return null;
      }
      throw error;
    }
    if (!newTenant?.id) return null;

    // Persist tenant ID immediately so retries use the idempotent update path
    setCreatedTenantId(newTenant.id);

    const settingsUpdate: Record<string, unknown> = {};
    if (wsData.avatarMode === "image" && wsData.logoFile) {
      const logoUrl = await uploadLogoToStorage(wsData.logoFile, newTenant.id);
      settingsUpdate.icon_url = logoUrl;
    } else {
      settingsUpdate.icon_name = wsData.selectedIcon;
      settingsUpdate.icon_color = wsData.selectedColor;
    }
    await supabase.from("tenant_settings").update(settingsUpdate).eq("tenant_id", newTenant.id);

    return newTenant.id;
  };

  const saveGoal = async () => {
    if (!createdTenantId) return;
    await supabase.from("tenant_profile").update({
      onboarding_goal: selectedGoal,
      referral_source: wsData.referralSource || null,
    }).eq("tenant_id", createdTenantId);
  };

  const saveCustomerCount = async () => {
    if (!createdTenantId) return;
    await supabase.from("tenant_profile").update({ customer_count: selectedCustomerCount }).eq("tenant_id", createdTenantId);
  };

  const saveRevenue = async () => {
    if (!createdTenantId) return;
    await supabase.from("tenant_profile").update({ annual_revenue: selectedRevenue }).eq("tenant_id", createdTenantId);
  };

  const saveUsedTools = async () => {
    if (!createdTenantId) return;
    await supabase.from("tenant_profile").update({ used_tools: selectedTools.length > 0 ? selectedTools : null }).eq("tenant_id", createdTenantId);
  };

  const finishOnboarding = async () => {
    if (createdTenantId && user) {
      const currentPrefs = (await supabase.from("profiles").select("preferences").eq("user_id", user.id).maybeSingle()).data?.preferences ?? {};
      await supabase.from("profiles").update({
        preferences: { ...(typeof currentPrefs === "object" && currentPrefs !== null ? currentPrefs : {}), default_workspace_id: createdTenantId },
      }).eq("user_id", user.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant"] }),
        queryClient.invalidateQueries({ queryKey: ["user-workspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["has-workspace"] }),
      ]);
    }

    toast({ variant: "success", title: t("onboarding.completed"), description: t("onboarding.completedDesc") });
    navigate("/admin", { replace: true });
  };

  const advance = () => {
    if (currentStep < totalSteps - 1) setCurrentStep((s) => s + 1);
    else finishOnboarding();
  };

  const goBack = () => { if (currentStep > 0) setCurrentStep((s) => s - 1); };

  const handleStepSubmit = async () => {
    setSubmitting(true);
    try {
      if (currentStepName === "profile") {
        await saveProfile();
        advance();
      } else if (currentStepName === "workspace") {
        const tenantId = await createWorkspace();
        if (!tenantId) { setSubmitting(false); return; }
        setCreatedTenantId(tenantId);
        advance();
      } else if (currentStepName === "goal") {
        await saveGoal();
        advance();
      } else if (currentStepName === "customers") {
        await saveCustomerCount();
        advance();
      } else if (currentStepName === "revenue") {
        await saveRevenue();
        advance();
      } else if (currentStepName === "gateway") {
        await saveUsedTools();
        advance();
      } else if (currentStepName === "invite") {
        finishOnboarding();
      }
    } catch (error: unknown) {
      console.error("Onboarding step error:", error);
      toast({ variant: "destructive", title: t("common.error"), description: translateAppError(error, t("completeProfile.saveError")) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-20">
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between p-6">
        <div>
          <img src={BRAND_LOGO_DARK} alt={BRAND_NAME} className="h-6 dark:hidden" />
          <img src={BRAND_LOGO_LIGHT} alt={BRAND_NAME} className="h-6 hidden dark:block" />
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher userId={user?.id} />
        </div>
      </div>

      <div className="container flex flex-col items-center gap-20">
        {currentStepName === "profile" && (
          <ProfileStep onSubmit={handleStepSubmit} currentStep={currentStep} totalSteps={totalSteps} data={profileData} setData={setProfileData} />
        )}
        {currentStepName === "workspace" && (
          <WorkspaceStep onSubmit={handleStepSubmit} goBack={goBack} currentStep={currentStep} totalSteps={totalSteps} data={wsData} setData={setWsData} submitting={submitting} excludeTenantId={createdTenantId} />
        )}
        {currentStepName === "goal" && (
          <GoalStep onSubmit={handleStepSubmit} goBack={goBack} currentStep={currentStep} totalSteps={totalSteps} selectedGoal={selectedGoal} setSelectedGoal={setSelectedGoal} data={wsData} setData={setWsData} />
        )}
        {currentStepName === "customers" && (
          <CustomersStep onSubmit={handleStepSubmit} goBack={goBack} currentStep={currentStep} totalSteps={totalSteps} selectedCount={selectedCustomerCount} setSelectedCount={setSelectedCustomerCount} data={wsData} />
        )}
        {currentStepName === "revenue" && (
          <RevenueStep onSubmit={handleStepSubmit} goBack={goBack} currentStep={currentStep} totalSteps={totalSteps} selectedRevenue={selectedRevenue} setSelectedRevenue={setSelectedRevenue} data={wsData} />
        )}
        {currentStepName === "gateway" && (
          <GatewayStep onSubmit={handleStepSubmit} goBack={goBack} currentStep={currentStep} totalSteps={totalSteps} selectedTools={selectedTools} setSelectedTools={setSelectedTools} data={wsData} />
        )}
        {currentStepName === "invite" && (
          <InviteStep onSubmit={handleStepSubmit} goBack={goBack} currentStep={currentStep} totalSteps={totalSteps} tenantId={createdTenantId} />
        )}
      </div>
    </section>
  );
}
