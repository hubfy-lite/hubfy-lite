import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { translateAppError } from "@/lib/app-error-utils";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { ThemeSwitcher } from "@/components/auth/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";
import { WORKSPACE_ICONS } from "@/lib/workspace-icons";
import { BRAND_NAME, BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "@/lib/brand";
import {
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

const STEPS = ["workspace", "goal", "customers", "revenue", "gateway", "invite"] as const;

export default function AdminNewWorkspace() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { workspaces } = useUserWorkspaces();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hasWorkspaces = workspaces.length > 0;

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);

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
  const totalSteps = STEPS.length;

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

    const { data: newTenant, error } = await supabase
      .from("tenants")
      .insert({ name: wsData.wsName.trim(), slug: wsData.slug, created_by: user.id })
      .select("id")
      .single();

    if (error) {
      if (error.message?.includes("unique") || error.message?.includes("duplicate") || error.code === "23505") {
        setWsData((prev) => ({ ...prev, slugAvailable: false }));
        setCurrentStep(0);
        toast({ variant: "destructive", title: t("newWorkspace.slugUnavailable"), description: t("newWorkspace.slugUnavailableDesc") });
        return null;
      }
      throw error;
    }
    if (!newTenant?.id) return null;

    // Persist tenant ID immediately so retries use the idempotent update path
    setCreatedTenantId(newTenant.id);

    // Upload logo if selected (now tenant exists, we have permission)
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
    // Only now set the active workspace and invalidate queries — doing this earlier
    // would change useTenant's query key mid-wizard, causing unmount/remount.
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

  const goBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
    else if (hasWorkspaces) navigate("/admin");
  };

  const handleStepSubmit = async () => {
    setSubmitting(true);
    try {
      if (currentStepName === "workspace") {
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
      toast({ variant: "destructive", title: t("common.error"), description: translateAppError(error, t("newWorkspace.createError")) });
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
        {currentStepName === "workspace" && (
          <WorkspaceStep onSubmit={handleStepSubmit} goBack={hasWorkspaces ? goBack : undefined} currentStep={currentStep} totalSteps={totalSteps} data={wsData} setData={setWsData} submitting={submitting} excludeTenantId={createdTenantId} />
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
