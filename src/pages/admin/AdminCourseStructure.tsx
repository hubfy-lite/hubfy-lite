import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "@/hooks/usePageTitle";
import { withAppBrand } from "@/lib/page-title";
import { Plus, GripVertical, Check, X, ArrowLeft, Upload, Loader2, ImageIcon, ExternalLink, Eye, Search, Copy, Play } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
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
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { invalidateCourses } from "@/lib/query-invalidation";
import { useTenant } from "@/hooks/useTenant";
import {
  CATEGORY_OPTIONS,
  getCourseCategoryUnsplashQuery,
  type CourseCategory,
} from "@/lib/course-categories";
import { cleanCoverValue, getCoversPublicUrl, getLessonThumbnailUrl } from "@/lib/storage-urls";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import { getPublicSiteUrl, buildPublicUrl } from "@/lib/public-site-url";
import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";
import { CoverCropDialog } from "@/components/admin/CoverCropDialog";
import { isUnsplashConfigured } from "@/lib/unsplash";
import { slugify } from "@/lib/slugify";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface Lesson {
  id: string;
  public_id: string;
  title: string;
  sort_order: number;
  is_active: boolean;
  thumbnail_url: string | null;
}

interface Module {
  id: string;
  public_id: string;
  title: string;
  sort_order: number;
  is_default: boolean;
  lessons: Lesson[];
}

interface CourseData {
  id: string;
  public_id: string;
  title: string;
  slug: string;
  description: string | null;
  category: CourseCategory | null;
  cover_horizontal_url: string | null;
  updated_at: string;
  is_active: boolean;
  tenant_id: string;
}

// Sortable Module Component
function SortableModule({
  mod,
  headerContent,
  children,
}: {
  mod: Module;
  headerContent: React.ReactNode;
  children?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-muted/40 rounded-xl border border-border overflow-hidden"
    >
      <div className="flex items-center gap-3 p-3">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag module"
        >
          <GripVertical className="size-4" />
        </button>
        {headerContent}
      </div>
      {children}
    </div>
  );
}

// Sortable Lesson Component
function SortableLesson({
  lesson,
  children,
}: {
  lesson: Lesson;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-3.5 bg-background first:border-t-0 border-t border-border hover:bg-muted/50 transition-colors"
    >
      <div className="w-4" />
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag lesson"
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}

export default function AdminCourseStructure() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  usePageTitle(useMemo(() => course ? withAppBrand(t("nav.courses"), course.title) : null, [course, t]));

  // Course form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<CourseCategory | "">("");
  const [formCoverPath, setFormCoverPath] = useState("");
  const [formCoverDisplayUrl, setFormCoverDisplayUrl] = useState("");
  const [coverDirty, setCoverDirty] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

  // Inline editing state for modules/lessons
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState("");

  // Creating new items inline
  const [creatingModuleTitle, setCreatingModuleTitle] = useState("");
  const [creatingLessonInModuleId, setCreatingLessonInModuleId] = useState<string | null>(null);
  const [creatingLessonTitle, setCreatingLessonTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);

  const totalLessons = modules.reduce((acc, mod) => acc + mod.lessons.length, 0);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;

    setLoading(true);

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("id, public_id, title, slug, description, category, cover_horizontal_url, updated_at, is_active, tenant_id")
      .eq("public_id", courseId)
      .single();

    if (courseError) {
      toast.error(t("courseStructure.courseNotFound"));
      navigate("/admin/courses");
      return;
    }

    setCourse({ ...courseData, title: limitNameLength(courseData.title) });
    setFormTitle(limitNameLength(courseData.title));
    setFormDescription(courseData.description || "");
    setFormCategory(courseData.category || "");

    const coverVal = cleanCoverValue(courseData.cover_horizontal_url);
    setFormCoverPath(coverVal);
    setFormCoverDisplayUrl(
      coverVal ? getCoversPublicUrl(coverVal, courseData.updated_at) : ""
    );
    setCoverDirty(false);

    const { data: modulesData, error: modulesError } = await supabase
      .from("modules")
      .select(`
        id, public_id, title, sort_order, is_default,
        lessons (id, public_id, title, sort_order, is_active, thumbnail_url)
      `)
      .eq("course_id", courseData.id)
      .order("sort_order", { ascending: true });

    if (!modulesError && modulesData) {
      const formattedModules = modulesData.map((mod) => ({
        ...mod,
        title: limitNameLength(mod.title),
        lessons: (mod.lessons || [])
          .map((lesson) => ({ ...lesson, title: limitNameLength(lesson.title) }))
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
      setModules(formattedModules);
    }

    setLoading(false);
  }, [courseId, navigate, t]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  // Save course info
  const saveCourse = async () => {
    if (!course || !formTitle.trim()) return;

    setSaving(true);
    const nextUpdatedAt = new Date().toISOString();
    const trimmedTitle = limitNameLength(formTitle.trim());
    const titleChanged = trimmedTitle !== course.title;

    // Recalculate slug when title changes
    let newSlug = course.slug;
    if (titleChanged) {
      const baseSlug = slugify(trimmedTitle) || "curso";
      // Check uniqueness within tenant (excluding current course)
      const { data: existing } = await supabase
        .from("courses")
        .select("slug")
        .eq("tenant_id", course.tenant_id)
        .neq("id", course.id)
        .like("slug", `${baseSlug}%`);

      const takenSlugs = new Set(existing?.map((c) => c.slug) ?? []);
      newSlug = baseSlug;
      let suffix = 2;
      while (takenSlugs.has(newSlug)) {
        newSlug = `${baseSlug}-${suffix}`;
        suffix++;
      }
    }

    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      description: formDescription.trim() || null,
      category: (formCategory || null) as CourseCategory | null,
      cover_horizontal_url: formCoverPath || null,
    };
    if (titleChanged) payload.slug = newSlug;

    const { error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", course.id);

    if (error) {
      toast.error(t("courseStructure.saveError"));
    } else {
      setCourse({
        ...course,
        title: trimmedTitle,
        description: formDescription.trim() || null,
        category: (formCategory || null) as CourseCategory | null,
        cover_horizontal_url: formCoverPath || null,
        slug: newSlug,
        updated_at: nextUpdatedAt,
      });
      setFormCoverDisplayUrl(
        formCoverPath ? getCoversPublicUrl(formCoverPath, nextUpdatedAt) : ""
      );
      setCoverDirty(false);
      toast.success(t("courseStructure.saved"));
      invalidateCourses(queryClient);
    }
    setSaving(false);
  };

  // Cover: open crop dialog with objectURL
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

  // Cover: upload cropped blob to storage
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropDialogOpen(false);
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc("");

    if (!tenant?.id || !course?.id) return;
    setUploadingCover(true);
    try {
      const filePath = `tenant/${tenant.id}/courses/${course.id}/cover-horizontal.webp`;
      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(filePath, blob, { upsert: true, contentType: "image/webp" });
      if (uploadError) throw uploadError;

      const nextVersion = Date.now();
      setFormCoverPath(filePath);
      setFormCoverDisplayUrl(getCoversPublicUrl(filePath, nextVersion));
      setCoverDirty(true);
      toast.success(t("courseStructure.coverUploaded"));
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(t("courseStructure.coverUploadError"));
    } finally {
      setUploadingCover(false);
    }
  }, [cropImageSrc, course?.id, tenant?.id, t]);

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openCropDialog(file);
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) openCropDialog(file);
  };

  const handleUnsplashSelect = useCallback((blob: Blob) => {
    openCropDialog(blob);
  }, [openCropDialog]);

  const hasCourseChanges =
    !!course &&
    (formTitle !== course.title ||
      formDescription !== (course.description ?? "") ||
      formCategory !== (course.category ?? "") ||
      formCoverPath !== cleanCoverValue(course.cover_horizontal_url) ||
      coverDirty);

  // Module inline editing
  const startEditingModule = (mod: Module) => {
    setEditingModuleId(mod.id);
    setEditingModuleTitle(limitNameLength(mod.title));
  };

  const cancelEditingModule = () => {
    setEditingModuleId(null);
    setEditingModuleTitle("");
  };

  const saveModuleTitle = async () => {
    if (!editingModuleId || !editingModuleTitle.trim()) return;
    const limitedTitle = limitNameLength(editingModuleTitle.trim());

    setSaving(true);
    const { error } = await supabase
      .from("modules")
      .update({ title: limitedTitle })
      .eq("id", editingModuleId);

    if (error) {
      toast.error(t("courseStructure.moduleUpdateError"));
    } else {
      setModules((prev) =>
        prev.map((m) =>
          m.id === editingModuleId ? { ...m, title: limitedTitle } : m
        )
      );
      toast.success(t("courseStructure.moduleUpdated"));
    }

    setSaving(false);
    setEditingModuleId(null);
    setEditingModuleTitle("");
  };

  // Lesson inline editing
  const startEditingLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditingLessonTitle(limitNameLength(lesson.title));
  };

  const cancelEditingLesson = () => {
    setEditingLessonId(null);
    setEditingLessonTitle("");
  };

  const saveLessonTitle = async () => {
    if (!editingLessonId || !editingLessonTitle.trim()) return;
    const limitedTitle = limitNameLength(editingLessonTitle.trim());

    setSaving(true);
    const { error } = await supabase
      .from("lessons")
      .update({ title: limitedTitle })
      .eq("id", editingLessonId);

    if (error) {
      toast.error(t("courseStructure.lessonUpdateError"));
    } else {
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) =>
            l.id === editingLessonId ? { ...l, title: limitedTitle } : l
          ),
        }))
      );
      toast.success(t("courseStructure.lessonUpdated"));
    }

    setSaving(false);
    setEditingLessonId(null);
    setEditingLessonTitle("");
  };

  const getNextModulePlaceholder = () => t("courseStructure.newModulePlaceholder", { n: modules.length + 1 });

  const getNextLessonPlaceholder = (moduleId: string) => {
    const targetModule = modules.find((m) => m.id === moduleId);
    return t("courseStructure.newLessonPlaceholder", { n: (targetModule?.lessons.length || 0) + 1 });
  };

  // Create new module
  const createModule = async () => {
    if (!creatingModuleTitle.trim() || !course?.id) return;
    const limitedTitle = limitNameLength(creatingModuleTitle.trim());

    setSaving(true);
    const maxOrder = Math.max(0, ...modules.map((m) => m.sort_order));

    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id: course.id,
        title: limitedTitle,
        sort_order: maxOrder + 1,
        is_default: false,
      })
      .select("id, public_id, title, sort_order, is_default")
      .single();

    if (error) {
      toast.error(t("courseStructure.moduleCreateError"));
    } else {
      setModules((prev) => [...prev, { ...data, title: limitedTitle, lessons: [] }]);
      toast.success(t("courseStructure.moduleCreated"));
      setCreatingModuleTitle("");
    }

    setSaving(false);
  };

  // Create new lesson
  const startCreatingLesson = (moduleId: string) => {
    setCreatingLessonInModuleId(moduleId);
    setCreatingLessonTitle(getNextLessonPlaceholder(moduleId));
  };

  const cancelCreatingLesson = () => {
    setCreatingLessonInModuleId(null);
    setCreatingLessonTitle("");
  };

  const createLesson = async () => {
    if (!creatingLessonTitle.trim() || !creatingLessonInModuleId) return;
    const limitedTitle = limitNameLength(creatingLessonTitle.trim());

    setSaving(true);
    const targetModule = modules.find((m) => m.id === creatingLessonInModuleId);
    const maxOrder = Math.max(0, ...(targetModule?.lessons.map((l) => l.sort_order) || []));

    const { data, error } = await supabase
      .from("lessons")
      .insert({
        module_id: creatingLessonInModuleId,
        title: limitedTitle,
        sort_order: maxOrder + 1,
        is_active: true,
      })
      .select("id, public_id, title, sort_order, is_active, thumbnail_url")
      .single();

    if (error) {
      toast.error(t("courseStructure.lessonCreateError"));
    } else {
      setModules((prev) =>
        prev.map((m) =>
          m.id === creatingLessonInModuleId
            ? { ...m, lessons: [...m.lessons, { ...data, title: limitedTitle }] }
            : m
        )
      );
      toast.success(t("courseStructure.lessonCreated"));
      setCreatingLessonInModuleId(null);
      setCreatingLessonTitle("");
    }

    setSaving(false);
  };

  // Delete module
  const deleteModule = async (moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (mod?.is_default) {
      toast.error(t("courseStructure.cannotDeleteDefault"));
      return;
    }

    const { error } = await supabase.from("modules").delete().eq("id", moduleId);

    if (error) {
      toast.error(t("courseStructure.moduleDeleteError"));
    } else {
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
      toast.success(t("courseStructure.moduleDeleted"));
    }
  };

  // Delete lesson
  const deleteLesson = async (lessonId: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

    if (error) {
      toast.error(t("courseStructure.lessonDeleteError"));
    } else {
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons.filter((l) => l.id !== lessonId),
        }))
      );
      toast.success(t("courseStructure.lessonDeleted"));
    }
  };

  // Handle module drag end
  const handleModuleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id);
      const newIndex = modules.findIndex((m) => m.id === over.id);

      const newModules = arrayMove(modules, oldIndex, newIndex);
      setModules(newModules);

      for (let i = 0; i < newModules.length; i++) {
        await supabase
          .from("modules")
          .update({ sort_order: i })
          .eq("id", newModules[i].id);
      }
    }
  };

  // Handle lesson drag end
  const handleLessonDragEnd = async (moduleId: string, event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const targetModule = modules.find((m) => m.id === moduleId);
      if (!targetModule) return;

      const oldIndex = targetModule.lessons.findIndex((l) => l.id === active.id);
      const newIndex = targetModule.lessons.findIndex((l) => l.id === over.id);

      const newLessons = arrayMove(targetModule.lessons, oldIndex, newIndex);

      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, lessons: newLessons } : m))
      );

      for (let i = 0; i < newLessons.length; i++) {
        await supabase
          .from("lessons")
          .update({ sort_order: i })
          .eq("id", newLessons[i].id);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="max-w-[1200px] 3xl:max-w-[1600px] min-w-[800px] mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="p-6 lg:p-10">
      <div className="max-w-[1200px] 3xl:max-w-[1600px] min-w-[800px] mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="size-8 p-0" onClick={() => navigate("/admin/courses")}>
                <ArrowLeft className="size-3.5" />
              </Button>
              <h1 className="text-title">{formTitle || t("courseStructure.editCourse")}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={!course?.slug || !tenant?.slug}
                onClick={() => {
                  if (!course?.slug || !tenant?.slug) return;
                  if (!course.is_active) {
                    setActivateDialogOpen(true);
                    return;
                  }
                  window.open(buildPublicUrl(`/${tenant.slug}/${course.slug}`), "_blank", "noopener,noreferrer");
                }}
              >
                <Eye className="size-4" />
              </Button>
              <Button
                onClick={saveCourse}
                disabled={
                  saving ||
                  !formTitle.trim() ||
                  !hasCourseChanges
                }
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("common.save")}
              </Button>
            </div>
          </div>

          {/* Detalhes do curso */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t("courseStructure.courseDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ID do curso */}
              {course.public_id && (
                <>
                  <Field orientation="split">
                    <FieldContent>
                      <FieldLabel htmlFor="course-id">{t("common.id", { defaultValue: "ID" })}</FieldLabel>
                      <FieldDescription>
                        {t("courseStructure.courseIdDescription")}
                      </FieldDescription>
                    </FieldContent>
                    <FieldControl>
                      <div className="flex items-center gap-2">
                        <Input
                          id="course-id"
                          value={course.public_id}
                          variant="readOnly"
                          readOnly
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(course.public_id);
                            toast.success(t("common.idCopied"));
                          }}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    </FieldControl>
                  </Field>
                  <div className="border-t border-border" />
                </>
              )}

              {/* Capa */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel>{t("courseStructure.coverLabel")}</FieldLabel>
                  <FieldDescription>
                    {t("courseStructure.coverDesc")}
                  </FieldDescription>
                </FieldContent>
                <FieldControl>
                  {formCoverDisplayUrl ? (
                    <div className="relative group/cover" style={{ width: 320, height: 107 }}>
                      <img
                        src={formCoverDisplayUrl}
                        alt={t("courseStructure.coverAlt")}
                        className="w-full h-full object-cover rounded-xl border border-border"
                        onError={(e) => { e.currentTarget.src = "/images/placeholder.svg"; }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-2">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept={ACCEPTED_IMAGE_TYPES.join(",")}
                              onChange={handleCoverFileChange}
                              className="hidden"
                              disabled={uploadingCover}
                            />
                            <Button variant="secondary" size="sm" className="pointer-events-none" disabled={uploadingCover}>
                              {uploadingCover ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                              {t("courseStructure.changeImage")}
                            </Button>
                          </label>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setFormCoverPath("");
                              setFormCoverDisplayUrl("");
                              setCoverDirty(true);
                            }}
                            disabled={uploadingCover}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                        {isUnsplashConfigured() && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setUnsplashOpen(true)}
                            disabled={uploadingCover}
                          >
                            <Search className="size-3.5 mr-1.5" />
                            {t("unsplash.searchButton")}
                          </Button>
                        )}
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
                        disabled={uploadingCover}
                      />
                      {uploadingCover ? (
                        <Loader2 className="size-8 text-muted-foreground animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="size-8 text-muted-foreground mb-2" />
                          <span className="text-xs text-muted-foreground text-center px-2">
                            {t("courseStructure.clickOrDrag")}
                          </span>
                          <span className="text-xs text-muted-foreground/70 mt-1">
                            {t("courseStructure.coverFormats")}
                          </span>
                        </>
                      )}
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
                </FieldControl>
              </Field>

              <UnsplashPickerDialog
                open={unsplashOpen}
                onOpenChange={setUnsplashOpen}
                onSelect={(blob) => handleUnsplashSelect(blob)}
                defaultQuery={getCourseCategoryUnsplashQuery(formCategory || null)}
              />
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

              <div className="border-t border-border" />

              {/* Nome do curso */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel htmlFor="course-title">{t("courseStructure.courseNameLabel")}</FieldLabel>
                  <FieldDescription>
                    {t("courseStructure.courseNameDesc")}
                  </FieldDescription>
                </FieldContent>
                <FieldControl>
                  <Input
                    id="course-title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(limitNameLength(e.target.value))}
                    placeholder={t("courseStructure.courseNamePlaceholder")}
                    maxLength={FRONTEND_NAME_MAX_LENGTH}
                  />
                </FieldControl>
              </Field>


              <div className="border-t border-border" />

              {/* Descrição */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel htmlFor="course-description">{t("courseStructure.descriptionLabel")}</FieldLabel>
                  <FieldDescription>
                    {t("courseStructure.descriptionDesc")}
                  </FieldDescription>
                </FieldContent>
                <FieldControl>
                  <Textarea
                    {...NO_AUTOFILL_PROPS}
                    id="course-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value.slice(0, 300))}
                    placeholder={t("courseStructure.descriptionPlaceholder")}
                    rows={5}
                    maxLength={300}
                  />
                </FieldControl>
              </Field>

              <div className="border-t border-border" />

              {/* Categoria */}
              <Field orientation="split">
                <FieldContent>
                  <FieldLabel>{t("courseStructure.categoryLabel")}</FieldLabel>
                  <FieldDescription>
                    {t("courseStructure.categoryDesc")}
                  </FieldDescription>
                </FieldContent>
                <FieldControl>
                  <Select
                    value={formCategory}
                    onValueChange={(v) => setFormCategory(v as CourseCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("courseStructure.categoryPlaceholder")} />
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
            </CardContent>
          </Card>

          {/* Structure Section */}
          <h2 className="text-section">{t("courseStructure.structure")}</h2>
          <p className="text-sm text-muted-foreground mb-3">
            {t("courseStructure.structureDescription")}
          </p>

          <Card variant="bordered" size="sm">
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-lg font-medium text-foreground">
                  {modules.length !== 1 ? t("courseStructure.moduleCount_plural", { count: modules.length }) : t("courseStructure.moduleCount", { count: modules.length })} •{" "}
                  {totalLessons !== 1 ? t("courseStructure.lessonCount_plural", { count: totalLessons }) : t("courseStructure.lessonCount", { count: totalLessons })}
                </p>
                <Button
                  size="xs"
                  onClick={() => setCreatingModuleTitle(getNextModulePlaceholder())}
                >
                  <Plus className="size-4" />
                  {t("courseStructure.addModule")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Modules List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleModuleDragEnd}
          >
            <SortableContext
              items={modules.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0">
                {modules.map((mod, index) => (
                  <div key={mod.id}>
                    {index > 0 && <Separator className="my-6" />}
                    <SortableModule
                      mod={mod}
                      headerContent={
                        editingModuleId === mod.id ? (
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
                            <Button variant="outline" size="icon-sm" onClick={saveModuleTitle} disabled={saving}>
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
                                !mod.is_default && { label: t("courseStructure.deleteModule"), onClick: () => deleteModule(mod.id), destructive: true },
                              ]}
                            />
                          </>
                        )
                      }
                    >
                      {/* Lessons within module */}
                      {(mod.lessons.length > 0 || creatingLessonInModuleId === mod.id) && (
                        <div className="border-t border-border">
                          {mod.lessons.length > 0 && (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(e) => handleLessonDragEnd(mod.id, e)}
                            >
                              <SortableContext
                                items={mod.lessons.map((l) => l.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {mod.lessons.map((lesson) => (
                                  <SortableLesson key={lesson.id} lesson={lesson}>
                                    <div
                                      className="w-14 h-8 rounded bg-muted/80 border border-border/50 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                                      onClick={() => navigate(`/admin/courses/${courseId}/lessons/${lesson.public_id}`)}
                                    >
                                      {lesson.thumbnail_url ? (
                                        <img
                                          src={getLessonThumbnailUrl(lesson.thumbnail_url)}
                                          alt=""
                                          className="size-full object-cover"
                                        />
                                      ) : (
                                        <Play className="size-3 text-muted-foreground/40" />
                                      )}
                                    </div>
                                    {editingLessonId === lesson.id ? (
                                      <>
                                        <Input
                                          value={editingLessonTitle}
                                          onChange={(e) => setEditingLessonTitle(limitNameLength(e.target.value))}
                                          className="flex-1 h-8 text-sm"
                                          maxLength={FRONTEND_NAME_MAX_LENGTH}
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") saveLessonTitle();
                                            if (e.key === "Escape") cancelEditingLesson();
                                          }}
                                        />
                                        <Button variant="outline" size="icon-sm" onClick={saveLessonTitle} disabled={saving}>
                                          <Check className="size-4" />
                                        </Button>
                                        <Button variant="outline" size="icon-sm" onClick={cancelEditingLesson}>
                                          <X className="size-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <span
                                          className="flex-1 text-sm cursor-pointer"
                                          onClick={() => navigate(`/admin/courses/${courseId}/lessons/${lesson.public_id}`)}
                                        >
                                          {lesson.title}
                                        </span>
                                        <ActionsMenu
                                          items={[
                                            { label: t("courseStructure.rename"), onClick: () => startEditingLesson(lesson) },
                                            { label: t("courseStructure.editLesson"), onClick: () => navigate(`/admin/courses/${courseId}/lessons/${lesson.public_id}`) },
                                            { label: t("courseStructure.deleteLesson"), onClick: () => deleteLesson(lesson.id), destructive: true },
                                          ]}
                                        />
                                      </>
                                    )}
                                  </SortableLesson>
                                ))}
                              </SortableContext>
                            </DndContext>
                          )}

                          {/* Creating new lesson inline */}
                          {creatingLessonInModuleId === mod.id && (
                            <div className="flex items-center gap-3 px-3 py-2 bg-background border-t border-border">
                              <div className="w-4" />
                              <GripVertical className="size-4 text-muted-foreground/30" />
                              <Input
                                value={creatingLessonTitle}
                                onChange={(e) => setCreatingLessonTitle(limitNameLength(e.target.value))}
                                placeholder={getNextLessonPlaceholder(mod.id)}
                                className="flex-1"
                                maxLength={FRONTEND_NAME_MAX_LENGTH}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") createLesson();
                                  if (e.key === "Escape") cancelCreatingLesson();
                                }}
                              />
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={createLesson}
                                disabled={saving || !creatingLessonTitle.trim()}
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button variant="outline" size="icon-sm" onClick={cancelCreatingLesson}>
                                <X className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Adicionar aula – abaixo das lessons */}
                      {creatingLessonInModuleId !== mod.id && (
                        <div className="border-t border-border px-3 py-3">
                          <Button variant="outline" size="xs" onClick={() => startCreatingLesson(mod.id)}>
                            <Plus className="size-4" />
                            {t("courseStructure.addLesson")}
                          </Button>
                        </div>
                      )}
                    </SortableModule>
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Creating new module inline */}
          {creatingModuleTitle && (
            <div className="bg-muted/40 rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <GripVertical className="size-4 text-muted-foreground/30" />
                <Input
                  value={creatingModuleTitle}
                  onChange={(e) => setCreatingModuleTitle(limitNameLength(e.target.value))}
                  placeholder={getNextModulePlaceholder()}
                  className="flex-1 max-w-md"
                  maxLength={FRONTEND_NAME_MAX_LENGTH}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createModule();
                    if (e.key === "Escape") setCreatingModuleTitle("");
                  }}
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={createModule}
                  disabled={saving || !creatingModuleTitle.trim()}
                >
                  <Check className="size-4" />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => setCreatingModuleTitle("")}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Botão Salvar inferior */}
          <div className="flex justify-end">
            <Button
              onClick={saveCourse}
              disabled={
                saving ||
                !formTitle.trim() ||
                !hasCourseChanges
              }
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>
      <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este curso está inativo</AlertDialogTitle>
            <AlertDialogDescription>
              Para visualizar a página do curso, você deve ativá-lo primeiro. Deseja fazer isso agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter inativo</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!course) return;
                const { error } = await supabase
                  .from("courses")
                  .update({ is_active: true })
                  .eq("id", course.id);
                if (error) {
                  toast.error(t("courses.toggleError", "Erro ao ativar curso"));
                } else {
                  setCourse({ ...course, is_active: true });
                  invalidateCourses(queryClient);
                  toast.success(t("courses.activated", "Curso ativado"));
                  if (tenant?.slug && course.slug) {
                    window.open(buildPublicUrl(`/${tenant.slug}/${course.slug}`), "_blank", "noopener,noreferrer");
                  }
                }
              }}
            >
              Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
