import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, Check, Users, Box, Trash2, Plus, X, CircleDollarSign, Upload, Copy } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import TeamSettingsTab from "@/components/admin/settings/TeamSettingsTab";
import SellerSettingsTab from "@/components/admin/settings/SellerSettingsTab";
import {
  SOCIAL_PLATFORMS,
  DEFAULT_SOCIAL_KEYS,
  getSocialPlatform,
  type SocialPlatformKey,
} from "@/components/icons/SocialIcons";
import {
  DropdownMenu as SocialDropdown,
  DropdownMenuContent as SocialDropdownContent,
  DropdownMenuItem as SocialDropdownItem,
  DropdownMenuTrigger as SocialDropdownTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminSettings() {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const { tenant, loading: tenantLoading, updateTenant } = useTenant();
  const { activeWorkspace } = useUserWorkspaces();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { tab: activeTab = "general" } = useParams<{ tab: string }>();
  const isMobile = useIsMobile();
  const isWorkspaceOwner = activeWorkspace?.role === "owner";

  const menuItems: { id: string; label: string; icon: React.ElementType }[] = [
    { id: "general", label: t("settings.tabs.general"), icon: Box },
    { id: "team", label: t("settings.tabs.team"), icon: Users },
    { id: "seller", label: t("settings.tabs.seller"), icon: CircleDollarSign },
  ];

  const [saving, setSaving] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const slugCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugCheckRequestRef = useRef(0);

  // Form state for tracking changes
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    support_email: "",
    website_url: "",
    whatsapp: "",
    email_sender_name: "",
    enable_sale_emails: true,
    social_links: {} as Record<string, string>,
  });

  // Track which social platforms are visible (default 4 + any with saved data)
  const [visibleSocials, setVisibleSocials] = useState<string[]>([...DEFAULT_SOCIAL_KEYS]);


  // Load tenant data into form
  useEffect(() => {
    if (tenant) {
      const savedLinks = (tenant.social_links ?? {}) as Record<string, string>;
      setFormData((prev) => ({
        ...prev,
        name: tenant.name || "",
        slug: tenant.slug || "",
        description: tenant.description || "",
        support_email: tenant.support_email || "",
        website_url: tenant.website_url || "",
        whatsapp: tenant.whatsapp || "",
        email_sender_name: tenant.email_sender_name || "",
        enable_sale_emails: tenant.enable_sale_emails ?? true,
        social_links: savedLinks,
      }));

      // Show default 4 + any platform that already has saved data
      const savedKeys = Object.keys(savedLinks).filter((k) => savedLinks[k]);
      const merged = [...new Set([...DEFAULT_SOCIAL_KEYS, ...savedKeys])];
      setVisibleSocials(merged);
    }
  }, [tenant]);

  const initialData = useMemo(
    () => ({
      name: tenant?.name || "",
      slug: tenant?.slug || "",
      description: tenant?.description || "",
      support_email: tenant?.support_email || "",
      website_url: tenant?.website_url || "",
      whatsapp: tenant?.whatsapp || "",
      email_sender_name: tenant?.email_sender_name || "",
      enable_sale_emails: tenant?.enable_sale_emails ?? true,
      social_links: (tenant?.social_links ?? {}) as Record<string, string>,
    }),
    [tenant]
  );

  const hasChanges = useMemo(() => {
    return (
      formData.name !== initialData.name ||
      formData.slug !== initialData.slug ||
      formData.description !== initialData.description ||
      formData.support_email !== initialData.support_email ||
      formData.website_url !== initialData.website_url ||
      formData.whatsapp !== initialData.whatsapp ||
      formData.email_sender_name !== initialData.email_sender_name ||
      formData.enable_sale_emails !== initialData.enable_sale_emails ||
      JSON.stringify(formData.social_links) !== JSON.stringify(initialData.social_links)
    );
  }, [formData, initialData]);

  const slugChanged = formData.slug !== initialData.slug;
  const slugHasMinLength = formData.slug.length >= 3;
  const canSaveSlug = !slugChanged || (slugHasMinLength && !checkingSlug && slugAvailable === true);
  const canSaveSettings = hasChanges && canSaveSlug;

  useEffect(() => {
    slugCheckRequestRef.current += 1;
    const requestId = slugCheckRequestRef.current;

    if (slugCheckTimerRef.current) {
      clearTimeout(slugCheckTimerRef.current);
      slugCheckTimerRef.current = null;
    }

    if (!tenant || !slugChanged) {
      setCheckingSlug(false);
      setSlugAvailable(null);
      return;
    }

    if (!slugHasMinLength) {
      setCheckingSlug(false);
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    slugCheckTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("id")
          .eq("slug", formData.slug)
          .neq("id", tenant.id)
          .maybeSingle();

        if (requestId !== slugCheckRequestRef.current) return;
        if (error) throw error;

        setSlugAvailable(!data);
      } catch {
        if (requestId !== slugCheckRequestRef.current) return;
        setSlugAvailable(null);
      } finally {
        if (requestId === slugCheckRequestRef.current) {
          setCheckingSlug(false);
        }
      }
    }, 400);

    return () => {
      if (slugCheckTimerRef.current) {
        clearTimeout(slugCheckTimerRef.current);
        slugCheckTimerRef.current = null;
      }
    };
  }, [formData.slug, slugChanged, slugHasMinLength, tenant, initialData.slug]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !tenant) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: t("profile.avatar.invalidFile") });
      return;
    }
    if (file.size > 512 * 1024) {
      toast({ variant: "destructive", title: t("profile.avatar.fileTooLarge") });
      return;
    }

    setUploadingIcon(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${tenant.id}_icon.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      await updateTenant({ icon_url: url });
      toast({ variant: "success", title: t("settings.general.saved") });
    } catch (error: unknown) {
      toast({ variant: "destructive", title: translateAppError(error, t("common.error")) });
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!tenant) return;
    try {
      await updateTenant({ icon_url: null });
      toast({ variant: "success", title: t("settings.general.saved") });
    } catch (error: unknown) {
      toast({ variant: "destructive", title: translateAppError(error, t("common.error")) });
    }
  };

  const handleSave = async () => {
    if (!hasChanges || !tenant) return;
    setSaving(true);

    try {
      if (slugChanged && !slugHasMinLength) {
        toast({
          variant: "destructive",
          title: t("settings.general.saveError"),
          description: t("settings.general.slugMinLength"),
        });
        setSaving(false);
        return;
      }

      // Check slug uniqueness if slug changed
      if (slugChanged) {
        const { data: existing, error: checkError } = await supabase
          .from("tenants")
          .select("id")
          .eq("slug", formData.slug)
          .neq("id", tenant.id)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          toast({
            variant: "destructive",
            title: t("settings.general.slugUnavailable"),
            description: t("settings.general.slugUnavailableDesc", { slug: formData.slug }),
          });
          setSaving(false);
          return;
        }
      }

      // Validate support email
      const trimmedEmail = formData.support_email?.trim();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        toast({
          variant: "destructive",
          title: t("settings.general.saveError"),
          description: t("settings.contact.supportEmailInvalid"),
        });
        setSaving(false);
        return;
      }

      // Validate website URL
      const trimmedUrl = formData.website_url?.trim();
      if (trimmedUrl && !/^https?:\/\/.+\..+/.test(trimmedUrl)) {
        toast({
          variant: "destructive",
          title: t("settings.general.saveError"),
          description: t("settings.contact.websiteUrlInvalid"),
        });
        setSaving(false);
        return;
      }

      // Clean empty social_links values before saving
      const cleanedLinks: Record<string, string> = {};
      for (const [key, value] of Object.entries(formData.social_links)) {
        if (value?.trim()) cleanedLinks[key] = value.trim();
      }

      await updateTenant({
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        email_sender_name: formData.email_sender_name || null,
        enable_sale_emails: formData.enable_sale_emails,
        social_links: cleanedLinks,
        support_email: formData.support_email?.trim() || null,
        website_url: formData.website_url?.trim() || null,
        whatsapp: formData.whatsapp?.trim() || null,
      });

      toast({
        variant: "success",
        title: t("settings.general.saved"),
        description: t("settings.general.savedDescription"),
      });
    } catch (error: unknown) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: t("settings.general.saveError"),
        description: translateAppError(error, t("settings.general.saveErrorDescription")),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!tenant || !user || deleting || deleteConfirmText !== tenant.name) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined;

      const { data } = await invokeEdgeFunction<{ success: boolean }>("delete-workspace", {
        body: { tenant_id: tenant.id },
        headers,
      });

      if (!data?.success) {
        throw new Error(t("settings.workspace.deleteError"));
      }

      const currentPrefs = (profile?.preferences as Record<string, unknown> | null) ?? {};
      if (currentPrefs.default_workspace_id === tenant.id) {
        const { default_workspace_id: _removed, ...rest } = currentPrefs;
        const { error: prefError } = await supabase
          .from("profiles")
          .update({ preferences: rest as Record<string, unknown> as import("@/integrations/supabase/types").Json })
          .eq("user_id", user.id);

        if (prefError) {
          console.warn("Erro ao limpar default_workspace_id:", prefError);
        } else {
          updateProfile({ preferences: rest });
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant"] }),
        queryClient.invalidateQueries({ queryKey: ["user-workspaces"] }),
      ]);

      toast({
        variant: "success",
        title: t("settings.workspace.deleted"),
        description: t("settings.workspace.deletedDescription"),
      });

      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      navigate("/admin");
    } catch (error: unknown) {
      console.error("Error deleting workspace:", error);
      toast({
        variant: "destructive",
        title: t("settings.workspace.deleteErrorTitle"),
        description: translateEdgeError(error),
      });
    } finally {
      setDeleting(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card variant="bordered">
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              {t("settings.general.noTenant")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10">
        <div className="space-y-6 w-full max-w-[1200px] 3xl:max-w-[1600px] mx-auto">
        {/* Header */}
        <h1 className="text-xl font-semibold tracking-normal text-foreground md:text-2xl">{t("settings.title")}</h1>

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => navigate(`/admin/settings/${v}`, { replace: true })} orientation={isMobile ? "horizontal" : "vertical"} className="gap-4 md:gap-8">
          <TabsList className="shrink-0 w-full overflow-x-auto md:w-auto">
            {menuItems.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                <item.icon className="size-4" />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content Area */}
          <div className="flex-1 space-y-6">

            {/* ══════════ TAB: Geral ══════════ */}
            <TabsContent value="general">
              <Card variant="bordered">
                <CardHeader>
                  <CardTitle>{t("settings.general.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="workspace-id">{t("settings.general.workspaceIdLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("settings.general.workspaceIdDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <div className="flex items-center gap-2">
                        <Input
                          id="workspace-id"
                          value={tenant.public_id ?? tenant.id}
                          variant="readOnly"
                          readOnly
                          className="font-normal"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(tenant.public_id ?? tenant.id);
                            toast({ title: t("common.idCopied") });
                          }}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel>{t("designPage.general.iconLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("designPage.general.iconDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <div className="flex items-center gap-3">
                        <div
                          className="size-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0 cursor-pointer group relative"
                          onClick={() => iconInputRef.current?.click()}
                        >
                          {tenant.icon_url ? (
                            <>
                              <img src={tenant.icon_url} alt="" className="size-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Upload className="size-4 text-white" />
                              </div>
                            </>
                          ) : uploadingIcon ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <WorkspaceAvatar iconName={tenant.icon_name} iconColor={tenant.icon_color} size="lg" className="rounded-xl" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                <Upload className="size-4 text-white" />
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon}>
                            {uploadingIcon ? <Loader2 className="size-4 animate-spin" /> : t("designPage.general.upload")}
                          </Button>
                          {tenant.icon_url && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogoDelete}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                        <input ref={iconInputRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} className="hidden" />
                      </div>
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="business-name">{t("settings.general.nameLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("settings.general.nameDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Input
                        id="business-name"
                        placeholder={t("settings.general.namePlaceholder")}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="business-slug">{t("settings.general.slugLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("settings.general.slugDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-xl bg-muted text-muted-foreground text-sm border border-r-0 border-border whitespace-nowrap">
                          seudominio.com/
                        </span>
                        <div className="relative flex-1">
                          <Input
                            {...NO_AUTOFILL_PROPS}
                            id="business-slug"
                            placeholder={t("settings.general.slugPlaceholder")}
                            className="rounded-l-none pr-20"
                            value={formData.slug}
                            minLength={3}
                            aria-invalid={slugChanged && slugHasMinLength && slugAvailable === false}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                          />
                          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                            {slugChanged && slugHasMinLength && (
                              <>
                                {checkingSlug && (
                                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                )}
                                {!checkingSlug && slugAvailable === true && (
                                  <Check className="size-4 text-success" />
                                )}
                                {!checkingSlug && slugAvailable === false && (
                                  <X className="size-4 text-destructive" />
                                )}
                              </>
                            )}
                            <span
                              className="text-muted-foreground"
                              title={t("settings.openPublicPage")}
                            >
                              <ExternalLink className="size-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                      {slugChanged && !slugHasMinLength && (
                        <p className="mt-1.5 text-xs text-destructive">
                          {t("settings.general.slugMinLength")}
                        </p>
                      )}
                      {slugChanged && slugHasMinLength && checkingSlug && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t("settings.general.slugChecking")}
                        </p>
                      )}
                      {slugChanged && slugHasMinLength && !checkingSlug && slugAvailable === true && (
                        <p className="mt-1.5 text-xs text-success">
                          {t("settings.general.slugAvailable")}
                        </p>
                      )}
                      {slugChanged && slugHasMinLength && !checkingSlug && slugAvailable === false && (
                        <p className="mt-1.5 text-xs text-destructive">
                          {t("settings.general.slugTaken")}
                        </p>
                      )}
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="business-description">{t("settings.general.descriptionLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("settings.general.descriptionDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Textarea
                        {...NO_AUTOFILL_PROPS}
                        id="business-description"
                        placeholder={t("settings.general.descriptionPlaceholder")}
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </FieldControl>
                  </Field>
                </CardContent>
              </Card>

              {/* ── Card: Emails transacionais ── */}
              <Card variant="bordered" className="mt-6">
                <CardHeader>
                  <CardTitle>{t("settings.emails.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel>{t("settings.emails.saleNotificationsLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("settings.emails.saleNotificationsDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Switch
                        checked={formData.enable_sale_emails}
                        onCheckedChange={(checked) => setFormData({ ...formData, enable_sale_emails: checked })}
                      />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel htmlFor="email-sender-name">{t("settings.emails.senderNameLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("settings.emails.senderNameDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Input
                        id="email-sender-name"
                        placeholder={t("settings.emails.senderNamePlaceholder")}
                        value={formData.email_sender_name || formData.name}
                        onChange={(e) => setFormData({ ...formData, email_sender_name: e.target.value })}
                      />
                    </FieldControl>
                  </Field>

                  <div className="border-t border-border" />

                  <Field orientation={isMobile ? "vertical" : "split"}>
                    <FieldContent>
                      <FieldLabel>{t("settings.emails.addressLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("settings.emails.addressDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <Input
                        value={t("settings.emails.addressConfiguredViaEnv", "Configurado via EMAIL_FROM_ADDRESS")}
                        disabled
                        className="text-muted-foreground"
                      />
                    </FieldControl>
                  </Field>
                </CardContent>
              </Card>

              {/* ── Card: Redes Sociais ── */}
              <Card variant="bordered" className="mt-6">
                <CardHeader>
                  <CardTitle>{t("settings.social.title", "Redes Sociais")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {visibleSocials.map((key) => {
                    const platform = getSocialPlatform(key);
                    if (!platform) return null;
                    const { Icon, label, baseUrl } = platform;
                    return (
                      <Field key={key} orientation={isMobile ? "vertical" : "split"}>
                        <FieldContent>
                          <FieldLabel className="gap-2.5">
                            <Icon className="size-4 text-muted-foreground" />
                            {label}
                          </FieldLabel>
                        </FieldContent>
                        <FieldControl>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-xl bg-muted text-muted-foreground text-sm border border-r-0 border-border whitespace-nowrap">
                              {baseUrl}
                            </span>
                            <div className="relative flex-1">
                              <Input
                                className="rounded-l-none"
                                placeholder={t("settings.social.placeholder", "seu-usuario")}
                                value={formData.social_links[key] || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    social_links: { ...formData.social_links, [key]: e.target.value },
                                  })
                                }
                              />
                              {!DEFAULT_SOCIAL_KEYS.some((defaultKey) => defaultKey === key) && (
                                <button
                                  type="button"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => {
                                    setVisibleSocials((prev) => prev.filter((k) => k !== key));
                                    const { [key]: _, ...rest } = formData.social_links;
                                    setFormData({ ...formData, social_links: rest });
                                  }}
                                >
                                  <X className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </FieldControl>
                      </Field>
                    );
                  })}

                  {/* Botão: Adicionar rede social */}
                  {(() => {
                    const remaining = SOCIAL_PLATFORMS.filter(
                      (p) => !visibleSocials.includes(p.key)
                    );
                    if (remaining.length === 0) return null;
                    return (
                      <SocialDropdown>
                        <SocialDropdownTrigger asChild>
                          <Button variant="outline" size="sm" className="mt-2">
                            <Plus className="size-4" />
                            {t("settings.social.add", "Adicionar rede social")}
                          </Button>
                        </SocialDropdownTrigger>
                        <SocialDropdownContent align="start">
                          {remaining.map(({ key, label, Icon }) => (
                            <SocialDropdownItem
                              key={key}
                              onClick={() => setVisibleSocials((prev) => [...prev, key])}
                              className="flex items-center gap-2"
                            >
                              <Icon className="size-4" />
                              {label}
                            </SocialDropdownItem>
                          ))}
                        </SocialDropdownContent>
                      </SocialDropdown>
                    );
                  })()}
                </CardContent>
              </Card>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving || !canSaveSettings}>
                  {saving ? (<><Loader2 className="size-4 animate-spin" />{t("common.saving")}</>) : t("common.save")}
                </Button>
              </div>

              {isWorkspaceOwner && (
                <Card
                  variant="bordered"
                  className="mt-6 border-destructive/30 ring-destructive/30"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <Trash2 className="size-5" />
                      Zona de perigo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Field orientation={isMobile ? "vertical" : "split"}>
                      <FieldContent>
                        <FieldLabel>Excluir workspace</FieldLabel>
                        <FieldDescription>
                          Ao excluir, todos os dados serão removidos: cursos, clientes, pedidos, integrações e configurações.
                        </FieldDescription>
                      </FieldContent>
                      <FieldControl className="flex justify-end self-end">
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setDeleteConfirmText("");
                            setShowDeleteDialog(true);
                          }}
                        >
                          Excluir workspace
                        </Button>
                      </FieldControl>
                    </Field>
                  </CardContent>
                </Card>
              )}

              <AlertDialog
                open={showDeleteDialog}
                onOpenChange={(open) => {
                  if (deleting) return;
                  setShowDeleteDialog(open);
                  if (!open) setDeleteConfirmText("");
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Excluir workspace permanentemente
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é irreversível. Digite{" "}
                      <span className="font-semibold text-foreground">
                        {tenant.name}
                      </span>{" "}
                      para confirmar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Nome do workspace
                    </p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      placeholder={tenant.name}
                      autoComplete="off"
                      disabled={deleting}
                    />
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleting || deleteConfirmText !== tenant.name}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleDeleteWorkspace();
                      }}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        "Excluir permanentemente"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>

            {/* ══════════ TAB: Equipe ══════════ */}
            <TabsContent value="team">
              <TeamSettingsTab />
            </TabsContent>


            {/* ══════════ TAB: Conta de pagamentos ══════════ */}
            <TabsContent value="seller">
              <SellerSettingsTab />
            </TabsContent>


          </div>
        </Tabs>

        </div>
      </div>
  );
}
