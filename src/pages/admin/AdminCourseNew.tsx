import { useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "@/hooks/usePageTitle";
import { withAppBrand } from "@/lib/page-title";
import { Plus, X, ImageIcon, Loader2, GripVertical, Search, Check, Play, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldContent, FieldControl, FieldDescription, FieldLabel } from "@/components/ui/field";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";
import {
  CATEGORY_OPTIONS,
  getCourseCategoryUnsplashQuery,
  type CourseCategory,
} from "@/lib/course-categories";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import { CoverCropDialog } from "@/components/admin/CoverCropDialog";
import { isUnsplashConfigured } from "@/lib/unsplash";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
import { slugify, RESERVED_SLUGS } from "@/lib/slugify";
import { AIGenerateButton } from "@/components/ai/AIGenerateButton";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;


interface StructureLesson {
  id: string;
  title: string;
}

interface StructureModule {
  id: string;
  title: string;
  lessons: StructureLesson[];
}

let idCounter = 0;
function tempId() {
  return `tmp-${++idCounter}`;
}

export default function AdminCourseNew() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { t } = useTranslation();

  usePageTitle(useMemo(() => withAppBrand(t("courses.newCourse")), [t]));

  // Card 1 — Sobre o curso
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CourseCategory | "">("");

  // Card 2 — Capa
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

  // Card 3 — Estrutura
  const [modules, setModules] = useState<StructureModule[]>([
    { id: tempId(), title: t("courseNew.initialModule"), lessons: [] },
  ]);
  const [addingLessonToModule, setAddingLessonToModule] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");

  // General
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cover handling — open crop dialog
  const openCropDialog = useCallback((source: File | Blob) => {
    if (source instanceof File) {
      if (!ACCEPTED_IMAGE_TYPES.includes(source.type)) {
        toast.error(t("courseStructure.invalidFormat"));
        return;
      }
      if (source.size > MAX_FILE_SIZE) {
        toast.error(t("courseStructure.fileTooLarge"));
        return;
      }
    }

    const url = URL.createObjectURL(source);
    setCropImageSrc(url);
    setCropDialogOpen(true);
  }, [t]);

  const handleCropConfirm = useCallback((blob: Blob) => {
    setCropDialogOpen(false);
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc("");

    const croppedFile = new File([blob], "cover-horizontal.webp", { type: "image/webp" });
    setCoverFile(croppedFile);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(croppedFile));
  }, [cropImageSrc, coverPreview]);

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openCropDialog(file);
    e.target.value = "";
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) openCropDialog(file);
  };

  const handleUnsplashSelect = useCallback((blob: Blob) => {
    openCropDialog(blob);
  }, [openCropDialog]);

  const removeCover = () => {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview("");
  };

  // Structure handling
  const addModule = () => {
    const num = modules.length + 1;
    setModules([...modules, { id: tempId(), title: t("courseNew.moduleN", { n: num }), lessons: [] }]);
  };

  const startEditingModule = (mod: StructureModule) => {
    setEditingModuleId(mod.id);
    setEditingModuleTitle(mod.title);
  };

  const saveModuleTitle = () => {
    if (!editingModuleId || !editingModuleTitle.trim()) return;
    setModules(modules.map((m) => (m.id === editingModuleId ? { ...m, title: limitNameLength(editingModuleTitle.trim()) } : m)));
    setEditingModuleId(null);
    setEditingModuleTitle("");
  };

  const cancelEditingModule = () => {
    setEditingModuleId(null);
    setEditingModuleTitle("");
  };

  const removeModule = (moduleId: string) => {
    if (modules.length <= 1) {
      toast.error(t("courseNew.courseNeedsOneModule"));
      return;
    }
    setModules(modules.filter((m) => m.id !== moduleId));
  };

  const addLesson = (moduleId: string) => {
    if (!newLessonTitle.trim()) return;
    setModules(
      modules.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: [...m.lessons, { id: tempId(), title: newLessonTitle.trim() }] }
          : m
      )
    );
    setNewLessonTitle("");
    setAddingLessonToModule(null);
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    setModules(
      modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      )
    );
  };

  // Submit
  const handleSubmit = async () => {
    if (!tenant?.id) {
      setError(t("courseNew.noTenantFound"));
      return;
    }
    if (!title.trim()) {
      setError(t("courseNew.titleRequired"));
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Auto-resolve slug conflicts
      const baseSlug = slugify(title.trim()) || "curso";
      const { data: existing } = await supabase
        .from("courses")
        .select("slug")
        .eq("tenant_id", tenant.id)
        .like("slug", `${baseSlug}%`);
      const takenSlugs = new Set(existing?.map((c) => c.slug) ?? []);
      let finalSlug = baseSlug;
      let suffix = 2;
      while (takenSlugs.has(finalSlug) || RESERVED_SLUGS.has(finalSlug)) {
        finalSlug = `${baseSlug}-${suffix}`;
        suffix++;
      }

      // 1. Create course (trigger creates default module)
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
          .insert({
          tenant_id: tenant.id,
          title: limitNameLength(title.trim()),
          description: description.trim() || null,
          slug: finalSlug,
          category: category || null,
          is_active: true,
        })
        .select("id, public_id")
        .single();

      if (courseError) throw courseError;
      const courseId = courseData.id;

      // 2. Upload cover if provided
      if (coverFile) {
        const filePath = `tenant/${tenant.id}/courses/${courseId}/cover-horizontal.webp`;
        const { error: uploadError } = await supabase.storage
          .from("covers")
          .upload(filePath, coverFile, { upsert: true, contentType: "image/webp" });

        if (!uploadError) {
          await supabase
            .from("courses")
            .update({ cover_horizontal_url: filePath })
            .eq("id", courseId);
        }
      }

      // 3. Delete the auto-created default module
      const { data: defaultModules } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", courseId)
        .eq("is_default", true);

      if (defaultModules?.length) {
        await supabase
          .from("modules")
          .delete()
          .in("id", defaultModules.map((m) => m.id));
      }

      // 4. Create user-defined modules + lessons
      for (let mi = 0; mi < modules.length; mi++) {
        const mod = modules[mi];
        const { data: moduleData, error: modError } = await supabase
          .from("modules")
          .insert({
            course_id: courseId,
            title: limitNameLength(mod.title.trim()),
            sort_order: mi,
            is_default: mi === 0,
          })
          .select("id")
          .single();

        if (modError) throw modError;

        if (mod.lessons.length > 0) {
          const lessonInserts = mod.lessons.map((l, li) => ({
            module_id: moduleData.id,
            title: limitNameLength(l.title.trim()),
            sort_order: li,
          }));

          const { error: lessError } = await supabase.from("lessons").insert(lessonInserts);
          if (lessError) throw lessError;
        }
      }

      toast.success(t("courseNew.courseCreated"));
      navigate(`/admin/courses/${courseData.public_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("courseNew.createError");
      setError(message);
      setLoading(false);
    }
  };

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  return (
    <div className="p-6 lg:p-10">
      <div className="space-y-6 w-full max-w-[1200px] 3xl:max-w-[1600px] min-w-[800px] mx-auto">
          {/* CTA */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/courses")}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
              {loading ? t("courseNew.creating") : t("courseNew.createCourse")}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-xl">
              {error}
            </p>
          )}

          {/* Card 1 — Sobre o curso */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-section">{t("courseNew.basicInfo")}</h2>
              <AIGenerateButton
                feature="course_basics"
                context={{ current_title: title }}
                onResult={(r) => {
                  setTitle(limitNameLength(r.title));
                  setDescription(r.description.slice(0, 300));
                }}
              />
            </div>
            <Card variant="bordered">
              <CardContent className="pt-6 space-y-6">
                <Field orientation="split">
                  <FieldContent>
                    <FieldLabel htmlFor="course-title">{t("courseStructure.courseNameLabel")}</FieldLabel>
                    <FieldDescription>{t("courseStructure.courseNameDesc")}</FieldDescription>
                  </FieldContent>
                  <FieldControl>
                    <Input
                      id="course-title"
                      value={title}
                      onChange={(e) => setTitle(limitNameLength(e.target.value))}
                      placeholder={t("courseNew.courseNamePlaceholder")}
                      maxLength={FRONTEND_NAME_MAX_LENGTH}
                    />
                  </FieldControl>
                </Field>


                <div className="border-t border-border" />

                <Field orientation="split">
                  <FieldContent>
                    <FieldLabel>{t("courseStructure.categoryLabel")}</FieldLabel>
                    <FieldDescription>{t("courseStructure.categoryDesc")}</FieldDescription>
                  </FieldContent>
                  <FieldControl>
                    <Select value={category} onValueChange={(v) => setCategory(v as CourseCategory)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("courseNew.selectCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldControl>
                </Field>

                <div className="border-t border-border" />

                <Field orientation="split">
                  <FieldContent>
                    <FieldLabel htmlFor="course-desc">{t("courseStructure.descriptionLabel")}</FieldLabel>
                    <FieldDescription>{t("courseStructure.descriptionDesc")}</FieldDescription>
                  </FieldContent>
                  <FieldControl>
                    <Textarea
                      {...NO_AUTOFILL_PROPS}
                      id="course-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                      placeholder={t("courseNew.descriptionPlaceholder")}
                      rows={3}
                      maxLength={300}
                    />
                  </FieldControl>
                </Field>
              </CardContent>
            </Card>
          </div>

          {/* Card 2 — Capa */}
          <div>
            <h2 className="text-section mb-3">{t("courseNew.cover")}</h2>
            <Card variant="bordered">
              <CardContent className="pt-6">
                <Field orientation="split">
                  <FieldContent>
                    <FieldLabel>{t("courseStructure.coverLabel")}</FieldLabel>
                  <FieldDescription>{t("courseStructure.coverDesc")}</FieldDescription>
                  </FieldContent>
                  <FieldControl>
                    {coverPreview ? (
                      <div className="relative group" style={{ width: 320, height: 107 }}>
                        <img
                          src={coverPreview}
                          alt={t("courseNew.coverAlt")}
                          className="w-full h-full object-cover rounded-xl border border-border"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center justify-center gap-2">
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                                  onChange={handleCoverFileChange}
                                  className="hidden"
                                />
                                <Button variant="secondary" size="sm" className="pointer-events-none">
                                  {t("courseNew.change")}
                                </Button>
                              </label>
                              <Button variant="destructive" size="sm" onClick={removeCover}>
                                <X className="size-4" />
                              </Button>
                            </div>
                            {isUnsplashConfigured() && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setUnsplashOpen(true)}
                              >
                                <Search className="size-3.5 mr-1.5" />
                                {t("unsplash.searchButton")}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <label
                          style={{ width: 320, height: 107 }}
                          className={cn(
                            "flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                            dragOver
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                          )}
                          onDrop={handleCoverDrop}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                        >
                          <input
                            type="file"
                            accept={ACCEPTED_IMAGE_TYPES.join(",")}
                            onChange={handleCoverFileChange}
                            className="hidden"
                          />
                          <ImageIcon className="size-8 text-muted-foreground mb-2" />
                          <span className="text-xs text-muted-foreground text-center">
                            {t("courseNew.clickOrDrag")}
                          </span>
                          <span className="text-xs text-muted-foreground/70 mt-1 text-center leading-tight">
                            {t("courseNew.coverFormats")}
                          </span>
                        </label>
                        {isUnsplashConfigured() && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setUnsplashOpen(true)}
                          >
                            <Search className="size-3.5 mr-1.5" />
                            {t("unsplash.searchButton")}
                          </Button>
                        )}
                      </>
                    )}
                    <UnsplashPickerDialog
                      open={unsplashOpen}
                      onOpenChange={setUnsplashOpen}
                      onSelect={handleUnsplashSelect}
                      defaultQuery={getCourseCategoryUnsplashQuery(category || null)}
                    />
                  </FieldControl>
                </Field>
                <CoverCropDialog
                  open={cropDialogOpen}
                  onOpenChange={(open) => {
                    if (!open && cropImageSrc) URL.revokeObjectURL(cropImageSrc);
                    if (!open) setCropImageSrc("");
                    setCropDialogOpen(open);
                  }}
                  imageSrc={cropImageSrc}
                  onConfirm={handleCropConfirm}
                />
              </CardContent>
            </Card>
          </div>

          {/* Card 3 — Estrutura */}
          <div>
            <h2 className="text-section">{t("courseNew.structure")}</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {t("courseNew.structureDescription")}
            </p>
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 mb-4">
              <Lightbulb className="size-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t("courseNew.structureTipTitle")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("courseNew.structureTipBody")}</p>
              </div>
            </div>

            <Card variant="bordered" size="sm" className="mb-4">
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {t("courseNew.modulesCount", { count: modules.length })} •{" "}
                    {t("courseNew.lessonsCount", { count: totalLessons })}
                  </p>
                  <Button size="xs" onClick={addModule}>
                    <Plus className="size-4" />
                    {t("courseNew.addModule")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {modules.map((mod) => (
                <div key={mod.id} className="bg-muted/40 rounded-xl border border-border overflow-hidden">
                  {/* Module header */}
                  <div className="flex items-center gap-3 p-3">
                    <GripVertical className="size-4 text-muted-foreground shrink-0" />
                    {editingModuleId === mod.id ? (
                      <>
                        <Input
                          value={editingModuleTitle}
                          onChange={(e) => setEditingModuleTitle(limitNameLength(e.target.value))}
                          className="flex-1 max-w-md"
                          maxLength={FRONTEND_NAME_MAX_LENGTH}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveModuleTitle();
                            if (e.key === "Escape") cancelEditingModule();
                          }}
                        />
                        <Button variant="outline" size="icon-sm" onClick={saveModuleTitle}>
                          <Check className="size-4" />
                        </Button>
                        <Button variant="outline" size="icon-sm" onClick={cancelEditingModule}>
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span
                          className="flex-1 font-medium cursor-pointer hover:underline hover:decoration-dashed hover:decoration-muted-foreground hover:underline-offset-4"
                          onClick={() => startEditingModule(mod)}
                        >
                          {mod.title}
                        </span>
                        <ActionsMenu
                          items={[
                            { label: t("courseStructure.rename"), onClick: () => startEditingModule(mod) },
                            modules.length > 1 && { label: t("courseStructure.deleteModule"), onClick: () => removeModule(mod.id), destructive: true },
                          ]}
                        />
                      </>
                    )}
                  </div>

                  {/* Lessons list */}
                  {mod.lessons.length > 0 && (
                    <div className="border-t border-border">
                      {mod.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-3 px-3 py-3.5 bg-background border-t first:border-t-0 border-border"
                        >
                          <div className="w-4" />
                          <GripVertical className="size-4 text-muted-foreground/30" />
                          <div className="w-14 h-8 rounded bg-muted/80 border border-border/50 flex items-center justify-center shrink-0">
                            <Play className="size-3 text-muted-foreground/40" />
                          </div>
                          <span className="flex-1 text-sm truncate">
                            {lesson.title}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLesson(mod.id, lesson.id)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add lesson inline input */}
                  {addingLessonToModule === mod.id && (
                    <div className="flex items-center gap-3 px-3 py-3.5 bg-background border-t border-border">
                      <div className="w-4" />
                      <GripVertical className="size-4 text-muted-foreground/30" />
                      <div className="w-14 h-8 rounded bg-muted/80 border border-border/50 flex items-center justify-center shrink-0">
                        <Play className="size-3 text-muted-foreground/40" />
                      </div>
                      <Input
                        value={newLessonTitle}
                        onChange={(e) => setNewLessonTitle(limitNameLength(e.target.value))}
                        placeholder={t("courseNew.lessonPlaceholder")}
                        className="flex-1 h-8 text-sm"
                        maxLength={FRONTEND_NAME_MAX_LENGTH}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addLesson(mod.id);
                          if (e.key === "Escape") {
                            setAddingLessonToModule(null);
                            setNewLessonTitle("");
                          }
                        }}
                      />
                      <Button variant="outline" size="icon-sm" onClick={() => addLesson(mod.id)} disabled={!newLessonTitle.trim()}>
                        <Check className="size-4" />
                      </Button>
                      <Button variant="outline" size="icon-sm" onClick={() => { setAddingLessonToModule(null); setNewLessonTitle(""); }}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}

                  {/* Add lesson button */}
                  {addingLessonToModule !== mod.id && (
                    <div className="border-t border-border px-3 py-3">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setAddingLessonToModule(mod.id);
                          setNewLessonTitle("");
                        }}
                      >
                        <Plus className="size-4" />
                        {t("courseNew.addLesson")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom submit */}
          <div className="flex justify-end pt-2 pb-10">
            <Button onClick={handleSubmit} disabled={loading || !title.trim()} size="lg">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("courseNew.creating")}
                </>
              ) : (
                t("courseNew.createCourse")
              )}
            </Button>
        </div>
      </div>
    </div>
  );
}
