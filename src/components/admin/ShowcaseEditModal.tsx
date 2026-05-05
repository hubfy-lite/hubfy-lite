import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2 } from "lucide-react";
import {
  FullscreenModal,
  FullscreenModalContent,
  FullscreenModalTitle,
} from "@/components/ui/fullscreen-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { ShowcaseGeneralSection, type ShowcaseFormData } from "./showcase-edit/ShowcaseGeneralSection";
import { ShowcaseCoursesSection, type LinkedCourse } from "./showcase-edit/ShowcaseCoursesSection";
import { ShowcaseLayoutSection } from "./showcase-edit/ShowcaseLayoutSection";
import { ShowcaseAccessSection } from "./showcase-edit/ShowcaseAccessSection";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import { invalidateShowcases } from "@/lib/query-invalidation";
import type { PreviewCourse } from "@/components/admin/showcase/ShowcasePreview";
import { limitNameLength } from "@/lib/name-limits";

interface ShowcaseEditModalProps {
  showcaseId: string | null; // null = new
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

type Section = "general" | "courses" | "layout" | "access";

const defaultForm: ShowcaseFormData = {
  title: "",
  slug: "",
  description: "",
  hero_url: null,
  bg_url: null,
  bg_dark_url: null,
  bg_light_url: null,
  logo_url: null,
  theme: "dark",
  grid_columns: 4,
  cover_format: "horizontal",
};

export function ShowcaseEditModal({
  showcaseId,
  open,
  onOpenChange,
  onSave,
}: ShowcaseEditModalProps) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isNew = !showcaseId;

  const sections: { id: Section; label: string }[] = [
    { id: "general", label: t("showcaseEdit.sections.general") },
    { id: "courses", label: t("showcaseEdit.sections.courses") },
    { id: "layout", label: t("showcaseEdit.sections.layout") },
    { id: "access", label: t("showcaseEdit.sections.access") },
  ];

  const [activeSection, setActiveSection] = useState<Section>("general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ShowcaseFormData>({ ...defaultForm });
  const [initialState, setInitialState] = useState<ShowcaseFormData>({ ...defaultForm });

  // Track created showcase id for new showcases
  const [createdId, setCreatedId] = useState<string | null>(null);
  const effectiveId = showcaseId || createdId;

  // Track the last saved slug for the "Acessar vitrine" link
  const [savedSlug, setSavedSlug] = useState<string | undefined>(undefined);

  // Courses section dirty state + save function
  const [coursesDirty, setCoursesDirty] = useState(false);
  const coursesSaveRef = useRef<(() => Promise<void>) | null>(null);

  const handleCoursesDirtyChange = useCallback((dirty: boolean) => {
    setCoursesDirty(dirty);
  }, []);

  const handleCoursesRegisterSave = useCallback((saveFn: () => Promise<void>) => {
    coursesSaveRef.current = saveFn;
  }, []);

  // Preview courses — derived from CoursesSection linkedCourses (live)
  const [previewCourses, setPreviewCourses] = useState<PreviewCourse[]>([]);

  const handleCoursesChange = useCallback((linked: LinkedCourse[]) => {
    setPreviewCourses(
      linked.map((lc) => ({
        id: lc.course.id,
        title: limitNameLength(lc.course.title),
        cover_url: lc.course.cover_horizontal_url
          ? getCoversOptimizedUrl(
              lc.course.cover_horizontal_url,
              "cover-card-horizontal",
              lc.course.updated_at
            ) || null
          : null,
      }))
    );
  }, []);

  const hasFormChanges = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialState);
  }, [form, initialState]);

  const hasChanges = hasFormChanges || coursesDirty;

  // Load existing showcase
  useEffect(() => {
    if (!open) {
      setActiveSection("general");
      setCreatedId(null);
      setSavedSlug(undefined);
      setCoursesDirty(false);
      coursesSaveRef.current = null;
      setPreviewCourses([]);
      return;
    }
    if (!showcaseId) {
      setForm({ ...defaultForm });
      setInitialState({ ...defaultForm });
      setLoading(false);
      return;
    }

    const fetchShowcase = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("showcases")
        .select("*")
        .eq("id", showcaseId)
        .single();

      if (error) {
        toast.error(t("showcaseEdit.loadError"));
        onOpenChange(false);
        return;
      }

      const loaded: ShowcaseFormData = {
        title: limitNameLength(data.title),
        slug: data.slug,
        description: data.description || "",
        hero_url: data.hero_url || null,
        bg_url: data.bg_url || null,
        bg_dark_url: data.bg_dark_url || null,
        bg_light_url: data.bg_light_url || null,
        logo_url: null, // logo_url not in DB yet
        theme: data.theme || "dark",
        grid_columns: data.grid_columns || 4,
        cover_format: "horizontal",
      };
      setForm(loaded);
      setInitialState(loaded);
      setSavedSlug(data.slug || undefined);
      setLoading(false);
    };

    fetchShowcase();
  }, [showcaseId, open, onOpenChange, t]);

  const handleChange = (patch: Partial<ShowcaseFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    if (!tenant || !user) return;
    if (!form.title.trim()) {
      toast.error(t("showcaseEdit.titleRequired"));
      return;
    }
    if (!form.slug.trim()) {
      toast.error(t("showcaseEdit.slugRequired"));
      return;
    }

    setSaving(true);
    try {
      // Check slug uniqueness
      const slugQuery = supabase
        .from("showcases")
        .select("id")
        .eq("slug", form.slug)
        .eq("tenant_id", tenant.id);

      if (effectiveId) slugQuery.neq("id", effectiveId);

      const { data: existing } = await slugQuery.maybeSingle();
      if (existing) {
        toast.error(t("showcaseEdit.slugInUse"));
        setSaving(false);
        return;
      }

      const payload = {
        title: limitNameLength(form.title.trim()),
        slug: form.slug,
        description: form.description || null,
        hero_url: form.hero_url,
        bg_url: form.bg_url,
        bg_dark_url: form.bg_dark_url,
        bg_light_url: form.bg_light_url,
        theme: form.theme,
        grid_columns: form.grid_columns,
        cover_format: form.cover_format,
      };

      if (isNew && !createdId) {
        const { data: newSc, error } = await supabase
          .from("showcases")
          .insert({ ...payload, tenant_id: tenant.id, is_public: true })
          .select()
          .single();
        if (error) throw error;

        setCreatedId(newSc.id);
        toast.success(t("showcaseEdit.created"));
      } else {
        const { error } = await supabase
          .from("showcases")
          .update(payload)
          .eq("id", effectiveId!);
        if (error) throw error;

        toast.success(t("showcaseEdit.updated"));
      }

      setInitialState({ ...form });
      setSavedSlug(form.slug);

      // Save courses if there are changes
      if (coursesDirty && coursesSaveRef.current) {
        await coursesSaveRef.current();
        setCoursesDirty(false);
      }

      invalidateShowcases(queryClient);
      onSave?.();
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("showcaseEdit.saveError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullscreenModal open={open} onOpenChange={onOpenChange}>
      <FullscreenModalContent className="bg-transparent" showCloseButton={false}>
        <FullscreenModalTitle className="sr-only">
          {isNew ? t("showcaseEdit.newTitle") : t("showcaseEdit.editTitle")}
        </FullscreenModalTitle>

        <div className="flex flex-col h-[100dvh] pt-12">
          <div className="flex-1 flex flex-col min-h-0 bg-card rounded-t-2xl border-t border-x border-border">
            {/* Header with tabs */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex-1" />

              <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "px-4 py-2 rounded-md text-base font-medium transition-colors",
                      activeSection === section.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>

              <div className="flex-1 flex justify-end">
                <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Content — único lugar com scroll */}
            <div className={cn(
              "flex-1 min-h-0 p-6 flex flex-col",
              activeSection === "layout" ? "overflow-hidden" : "overflow-y-auto"
            )}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className={cn(
                  "mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px]",
                  activeSection === "layout" && "h-full"
                )}>
                  <div className={activeSection !== "general" ? "hidden" : undefined}>
                    {user && (
                      <ShowcaseGeneralSection
                        form={form}
                        onChange={handleChange}
                        userId={user.id}
                        showcaseId={effectiveId || "new"}
                        savedSlug={savedSlug}
                      />
                    )}
                  </div>

                  <div className={activeSection !== "courses" ? "hidden" : undefined}>
                    {tenant && (
                      <ShowcaseCoursesSection
                        showcaseId={effectiveId || ""}
                        tenantId={tenant.id}
                        onDirtyChange={handleCoursesDirtyChange}
                        registerSave={handleCoursesRegisterSave}
                        onCoursesChange={handleCoursesChange}
                      />
                    )}
                  </div>

                  {activeSection === "layout" && (
                    <ShowcaseLayoutSection form={form} onChange={handleChange} courses={previewCourses} />
                  )}

                  <div className={activeSection !== "access" ? "hidden" : undefined}>
                    {user && (
                      <ShowcaseAccessSection
                        showcaseId={effectiveId || ""}
                        form={form}
                        onChange={handleChange}
                        userId={user.id}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="border-t border-border shrink-0 bg-card">
              <div className="max-w-[1200px] 3xl:max-w-[1600px] mx-auto flex items-center justify-end gap-3 px-6 py-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} disabled={saving || !hasChanges}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {isNew && !createdId ? t("common.create") : t("common.save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </FullscreenModalContent>
    </FullscreenModal>
  );
}
