import { useState, useEffect, useMemo, useRef } from "react";
import { Camera, Lock, Bell, Settings2, User, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { FlagBR, FlagUS, FlagES } from "@/components/ui/flags";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage, type Language } from "@/hooks/useLanguage";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getErrorMessage } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";

export default function AdminProfile() {
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { workspaces, activeWorkspace } = useUserWorkspaces();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab: activeTab = "profile" } = useParams<{ tab: string }>();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workspace padrão — fallback para o workspace ativo atual
  const savedDefaultWs = (profile?.preferences as Record<string, unknown> | null)?.default_workspace_id as string ?? "";
  const effectiveDefaultWs = savedDefaultWs || activeWorkspace?.id || workspaces[0]?.id || "";
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(effectiveDefaultWs);
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  useEffect(() => {
    const saved = (profile?.preferences as Record<string, unknown> | null)?.default_workspace_id as string ?? "";
    setSelectedWorkspace(saved || activeWorkspace?.id || workspaces[0]?.id || "");
  }, [profile?.preferences, activeWorkspace?.id, workspaces]);

  const hasWorkspaceChanges = selectedWorkspace !== effectiveDefaultWs;

  const retryOnAbort = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message.includes("AbortError")) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return await fn();
      }
      throw error;
    }
  };

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: profile?.name || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const initialData = useMemo(
    () => ({
      name: profile?.name || "",
    }),
    [profile?.name]
  );

  useEffect(() => {
    setFormData({
      name: profile?.name || "",
    });
    setAvatarUrl(profile?.avatar_url || null);
  }, [profile]);

  const hasChanges = useMemo(() => {
    return formData.name !== initialData.name;
  }, [formData, initialData]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: t("profile.avatar.invalidFile"),
        description: t("profile.avatar.invalidFileDescription"),
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: t("profile.avatar.fileTooLarge"),
        description: t("profile.avatar.fileTooLargeDescription"),
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const profileId = profile?.id || user.id;
      const fileName = `${user.id}/${profileId}_avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Preload image before updating UI
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // proceed even if preload fails
        img.src = newAvatarUrl;
        // Timeout fallback
        setTimeout(() => resolve(), 3000);
      });

      const { data: updated, error: updateError } = await retryOnAbort(async () =>
        supabase.from("profiles").update({ avatar_url: newAvatarUrl }).eq("user_id", user.id).select().single()
      );

      if (updateError) throw updateError;

      // Update local state and cache atomically (no refetch race)
      const finalUrl = updated?.avatar_url ?? newAvatarUrl;
      setAvatarUrl(finalUrl);
      updateProfile({ avatar_url: finalUrl });
      queryClient.setQueryData(["profile", user.id], (prev: Record<string, unknown> | undefined) =>
        prev ? { ...prev, avatar_url: finalUrl } : prev
      );
      toast({
        variant: "success",
        title: t("profile.avatar.updated"),
        description: t("profile.avatar.updatedDescription"),
      });
    } catch (error: unknown) {
      console.error("Error uploading avatar:", error);
      toast({
        variant: "destructive",
        title: t("profile.avatar.uploadError"),
        description: translateAppError(error, t("profile.avatar.uploadErrorDescription")),
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async () => {
    if (!hasChanges || !user) return;
    setSaving(true);

    try {
      const { data: updated, error } = await retryOnAbort(async () =>
        supabase
          .from("profiles")
          .update({
            name: formData.name,
          })
          .eq("user_id", user.id)
          .select()
          .single()
      );

      if (error) throw error;

      updateProfile({
        name: updated?.name ?? formData.name,
      });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast({
        variant: "success",
        title: t("profile.saved"),
        description: t("profile.savedDescription"),
      });
    } catch (error: unknown) {
      console.error("Error saving profile:", error);
      toast({
        variant: "destructive",
        title: t("profile.saveError"),
        description: translateAppError(error, t("profile.saveErrorDescription")),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkspace = async () => {
    if (!hasWorkspaceChanges || !user) return;
    setSavingWorkspace(true);

    try {
      const currentPrefs = (profile?.preferences as Record<string, unknown>) ?? {};
      const newPrefs = selectedWorkspace
        ? { ...currentPrefs, default_workspace_id: selectedWorkspace }
        : (() => { const { default_workspace_id: _, ...rest } = currentPrefs as Record<string, unknown>; return rest; })();

      const { error } = await retryOnAbort(async () =>
        supabase
          .from("profiles")
          .update({ preferences: newPrefs as Record<string, unknown> as import("@/integrations/supabase/types").Json })
          .eq("user_id", user.id)
      );

      if (error) throw error;

      updateProfile({ preferences: newPrefs as Record<string, unknown> });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast({
        variant: "success",
        title: t("profile.preferences.defaultWorkspaceSaved"),
        description: t("profile.preferences.defaultWorkspaceSavedDesc"),
      });
    } catch (error: unknown) {
      console.error("Error saving default workspace:", error);
      toast({
        variant: "destructive",
        title: t("profile.preferences.saveError"),
        description: translateAppError(error, t("profile.preferences.saveErrorDescription")),
      });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const isPasswordFormValid =
    passwordData.currentPassword.length > 0 &&
    passwordData.newPassword.length >= 8 &&
    passwordData.confirmPassword === passwordData.newPassword;

  const handlePasswordUpdate = async () => {
    if (!isPasswordFormValid) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        variant: "destructive",
        title: t("profile.password.passwordsMismatch"),
        description: t("profile.password.passwordsMismatchDescription"),
      });
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await updatePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (error) throw error;

      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({
        variant: "success",
        title: t("profile.password.success"),
        description: t("profile.password.successDescription"),
      });
    } catch (error: unknown) {
      console.error("Error updating password:", error);
      toast({
        variant: "destructive",
        title: t("profile.password.errorTitle"),
        description: translateAppError(error, t("profile.password.errorDescription")),
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10">
        <div className="space-y-6 w-full max-w-[1200px] 3xl:max-w-[1600px] mx-auto">
          {/* Header */}
          <h1 className="text-xl font-semibold tracking-normal text-foreground md:text-2xl">{t("profile.title")}</h1>

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => navigate(`/admin/profile/${v}`, { replace: true })} orientation={isMobile ? "horizontal" : "vertical"} className="gap-4 md:gap-8">
          <TabsList className="shrink-0 w-full overflow-x-auto md:w-auto">
            <TabsTrigger value="profile">
              <User className="size-4" />
              {t("profile.tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Settings2 className="size-4" />
              {t("profile.tabs.preferences")}
            </TabsTrigger>
            <TabsTrigger value="password">
              <Lock className="size-4" />
              {t("profile.tabs.password")}
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="size-4" />
              {t("profile.tabs.notifications")}
            </TabsTrigger>
          </TabsList>

          {/* Content Area */}
          <div className="flex-1 space-y-6">
            {/* Perfil */}
            <TabsContent value="profile">
              <Card variant="bordered">
                <CardHeader>
                  <CardTitle>{t("profile.info.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Foto de perfil */}
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel>{t("profile.info.photoLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.info.photoDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="size-20 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={formData.name || "Avatar"}
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl font-semibold text-muted-foreground">
                                {formData.name?.charAt(0)?.toUpperCase() || "U"}
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon"
                            className="absolute -bottom-1 -right-1 rounded-full size-8"
                            onClick={handleAvatarClick}
                            disabled={uploading}
                          >
                            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  {/* Nome */}
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="profile-name">{t("profile.info.nameLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.info.nameDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Input
                        id="profile-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t("profile.info.namePlaceholder")}
                      />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  {/* Email */}
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="profile-email">{t("profile.info.emailLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.info.emailDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Input id="profile-email" value={user?.email || ""} variant="readOnly" readOnly />
                    </FieldControl>
                  </Field>
                </CardContent>
              </Card>
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving || !hasChanges}>
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("common.saving")}
                    </>
                  ) : (
                    t("common.save")
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Preferências */}
            <TabsContent value="preferences">
              <Card variant="bordered">
                <CardHeader>
                  <CardTitle>{t("profile.preferences.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="theme-toggle">{t("profile.preferences.themeLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.preferences.themeDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Switch
                        id="theme-toggle"
                        checked={theme === "dark"}
                        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                      />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="language-select">{t("profile.preferences.languageLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.preferences.languageDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Select
                        value={language}
                        onValueChange={(v) => setLanguage(v as Language, user?.id)}
                      >
                        <SelectTrigger id="language-select" className="w-full sm:w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">
                            <span className="flex items-center gap-2">
                              <FlagBR className="size-4" />
                              {t("language.pt-BR")}
                            </span>
                          </SelectItem>
                          <SelectItem value="en">
                            <span className="flex items-center gap-2">
                              <FlagUS className="size-4" />
                              {t("language.en")}
                            </span>
                          </SelectItem>
                          <SelectItem value="es">
                            <span className="flex items-center gap-2">
                              <FlagES className="size-4" />
                              {t("language.es")}
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="default-workspace-select">
                        {t("profile.preferences.defaultWorkspaceLabel")}
                      </FieldLabel>
                      <FieldDescription>
                        {t("profile.preferences.defaultWorkspaceDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Select
                        value={selectedWorkspace}
                        onValueChange={setSelectedWorkspace}
                      >
                        <SelectTrigger id="default-workspace-select" className="w-full sm:w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaces.map((ws) => (
                            <SelectItem key={ws.id} value={ws.id}>
                              {ws.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldControl>
                  </Field>
                </CardContent>
              </Card>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveWorkspace}
                  disabled={savingWorkspace || !hasWorkspaceChanges}
                >
                  {savingWorkspace ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("common.saving")}
                    </>
                  ) : (
                    t("common.save")
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Alterar senha */}
            <TabsContent value="password">
              <Card variant="bordered">
                <CardHeader>
                  <CardTitle>{t("profile.password.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="current-password">{t("profile.password.currentLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.password.currentDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder={t("profile.password.currentPlaceholder")}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="new-password">{t("profile.password.newLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.password.newDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t("profile.password.newPlaceholder")}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="confirm-password">{t("profile.password.confirmLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.password.confirmDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <div className="space-y-2">
                        <Input
                          id="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={t("profile.password.confirmPlaceholder")}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        />
                        {passwordData.confirmPassword.length > 0 &&
                          passwordData.confirmPassword !== passwordData.newPassword && (
                            <p className="text-sm text-destructive">{t("profile.password.mismatch")}</p>
                          )}
                      </div>
                    </FieldControl>
                  </Field>
                </CardContent>
              </Card>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handlePasswordUpdate}
                  disabled={!isPasswordFormValid || savingPassword}
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("profile.password.submitting")}
                    </>
                  ) : (
                    t("profile.password.submitButton")
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Notificações */}
            <TabsContent value="notifications">
              <Card variant="bordered">
                <CardHeader>
                  <CardTitle>{t("profile.notifications.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="notif-email">{t("profile.notifications.emailLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.notifications.emailDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Switch id="notif-email" defaultChecked />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="notif-marketing">{t("profile.notifications.marketingLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.notifications.marketingDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Switch id="notif-marketing" />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="notif-activity">{t("profile.notifications.activityLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("profile.notifications.activityDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Switch id="notif-activity" defaultChecked />
                    </FieldControl>
                  </Field>
                </CardContent>
              </Card>
            </TabsContent>

          </div>
        </Tabs>
        </div>
      </div>
  );
}
