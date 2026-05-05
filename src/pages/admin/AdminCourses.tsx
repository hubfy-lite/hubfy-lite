import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search, Eye, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CardListSkeleton } from "@/components/admin/TableSkeleton";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import { useTenant } from "@/hooks/useTenant";
import { buildPublicUrl } from "@/lib/public-site-url";
import { toast } from "sonner";
import { invalidateCourses } from "@/lib/query-invalidation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS, type CourseCategory } from "@/lib/course-categories";
import { limitNameLength } from "@/lib/name-limits";

interface Course {
  id: string;
  public_id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail?: string;
  is_active: boolean;
  category: CourseCategory | null;
  modulesCount: number;
  lessonsCount: number;
  created_at: string;
  updated_at: string;
}

const ADMIN_IMAGE_PLACEHOLDER = "/images/placeholder.svg";


export default function AdminCourses() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tenant, loading: tenantLoading } = useTenant();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const hasLoadedOnce = useRef(false);

  const { data: courses = [], isPending } = useQuery({
    queryKey: ["courses", tenant?.id],
    queryFn: async () => {
      if (!tenant) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id, public_id, slug, title, description, cover_horizontal_url, is_active, category, created_at, updated_at, modules(id, lessons(id))")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((course) => ({
        id: course.id,
        public_id: course.public_id,
        slug: course.slug,
        title: limitNameLength(course.title),
        description: course.description ?? "",
        thumbnail: course.cover_horizontal_url
          ? getCoversOptimizedUrl(course.cover_horizontal_url, "admin-card-wide", course.updated_at)
          : undefined,
        is_active: course.is_active,
        category: course.category,
        modulesCount: course.modules?.length ?? 0,
        lessonsCount: course.modules?.reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0) ?? 0,
        created_at: course.created_at,
        updated_at: course.updated_at,
      }));
    },
    enabled: !!tenant,
    staleTime: 10_000,
  });

  if (!isPending && courses.length >= 0) {
    hasLoadedOnce.current = true;
  }

  const loading = tenantLoading || (!!tenant && isPending && !hasLoadedOnce.current);

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && course.is_active) ||
      (statusFilter === "inactive" && !course.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex h-full min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
        {/* Header + CTA */}
        <div className="flex min-w-0 shrink-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal text-foreground md:text-2xl">
              {t("courses.title")}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                onClick={() => navigate("/admin/courses/new")}
                size="sm"
                className="shrink-0 gap-1 px-2.5 text-xs md:h-9 md:gap-2 md:px-4 md:text-sm"
              >
                <Plus className="size-3.5 md:size-4" />
                <span className="md:hidden">Add</span>
                <span className="hidden md:inline">{t("courses.newCourse")}</span>
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1 max-w-none sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
              <Input
                placeholder={t("courses.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm md:h-10 md:pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[160px] md:h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("courses.filterAll")}</SelectItem>
                <SelectItem value="active">{t("courses.filterActive")}</SelectItem>
                <SelectItem value="inactive">{t("courses.filterInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Courses List */}
        {loading ? (
          <CardListSkeleton rows={4} />
        ) : filteredCourses.length === 0 ? (
          <Card variant="bordered">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("courses.emptyTitle")}
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                {t("courses.emptyDescription")}
              </p>
              <Button onClick={() => navigate("/admin/courses/new")}>
                <Plus className="size-4" />
                {t("courses.createFirst")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredCourses.map((course) => (
              <CourseRow key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseRow({ course }: { course: Course }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);

  const handleDuplicate = async () => {
    if (!tenant || duplicating) return;
    setDuplicating(true);

    try {
      const { data, error } = await supabase.rpc("duplicate_course", {
        p_source_course_id: course.id,
        p_tenant_id: tenant.id,
      });

      if (error) throw error;

      const result = data as {
        course_id: string;
        public_id: string;
        slug: string;
        title: string;
        media_map: {
          course_cover_horizontal: string | null;
          lessons: { old_lesson_id: string; new_lesson_id: string; thumbnail_url: string }[];
        };
      };

      // Best-effort media copy
      let mediaWarning = false;
      const copyTasks: Promise<void>[] = [];

      const copyFile = async (src: string, dst: string, updateFn?: () => Promise<void>) => {
        const { error: copyErr } = await supabase.storage.from("covers").copy(src, dst);
        if (copyErr) {
          mediaWarning = true;
          return;
        }
        if (updateFn) await updateFn();
      };

      // Copy course covers
      const { media_map } = result;
      if (media_map.course_cover_horizontal) {
        const src = media_map.course_cover_horizontal;
        const dst = src.replace(`/courses/${course.id}/`, `/courses/${result.course_id}/`);
        if (src !== dst) {
          copyTasks.push(copyFile(src, dst, async () => {
            await supabase.from("courses").update({ cover_horizontal_url: dst }).eq("id", result.course_id);
          }));
        }
      }

      // Copy lesson thumbnails
      for (const lesson of media_map.lessons ?? []) {
        const src = lesson.thumbnail_url;
        const dst = src.replace(`/lessons/${lesson.old_lesson_id}/`, `/lessons/${lesson.new_lesson_id}/`);
        if (src !== dst) {
          copyTasks.push(copyFile(src, dst, async () => {
            await supabase.from("lessons").update({ thumbnail_url: dst }).eq("id", lesson.new_lesson_id);
          }));
        }
      }

      await Promise.allSettled(copyTasks);

      invalidateCourses(queryClient);

      if (mediaWarning) {
        toast.warning(t("courses.duplicatedMediaWarning"));
      } else {
        toast.success(t("courses.duplicated"));
      }

      navigate(`/admin/courses/${result.public_id}`);
    } catch {
      toast.error(t("courses.duplicateError"));
    } finally {
      setDuplicating(false);
    }
  };

  const publicCourseUrl =
    tenant?.slug && course.slug ? buildPublicUrl(`/${tenant.slug}/${course.slug}`) : null;

  const toggleActive = async () => {
    const newValue = !course.is_active;

    // Optimistic update
    queryClient.setQueryData(["courses", tenant?.id], (old: Course[] | undefined) =>
      old?.map((c) => (c.id === course.id ? { ...c, is_active: newValue } : c))
    );

    const { error } = await supabase
      .from("courses")
      .update({ is_active: newValue })
      .eq("id", course.id);

    if (error) {
      // Rollback
      queryClient.setQueryData(["courses", tenant?.id], (old: Course[] | undefined) =>
        old?.map((c) => (c.id === course.id ? { ...c, is_active: !newValue } : c))
      );
      toast.error(t("courses.toggleError"));
    } else {
      invalidateCourses(queryClient);
      toast.success(newValue ? t("courses.activated") : t("courses.deactivated"));
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", course.id)
        .eq("tenant_id", tenant.id);

      if (error) throw error;

      queryClient.setQueryData(["courses", tenant.id], (old: Course[] | undefined) =>
        old?.filter((c) => c.id !== course.id)
      );
      invalidateCourses(queryClient);
      toast.success(t("courses.courseDeleted"));
      setDeleteOpen(false);
      setDeleteConfirmText("");
    } catch {
      toast.error(t("courses.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        variant="bordered"
        size="sm"
        className="hover:border-foreground/20 transition-colors cursor-pointer"
        onClick={() => navigate(`/admin/courses/${course.public_id}`)}
      >
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            {/* Thumbnail */}
            <div className="h-10 aspect-[3/1] rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {course.thumbnail ? (
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="size-full object-cover"
                />
              ) : (
                <img
                  src={ADMIN_IMAGE_PLACEHOLDER}
                  alt=""
                  className="size-full object-cover opacity-70"
                  loading="lazy"
                />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {course.title}
              </h3>
              {course.category && (
                <p className="text-xs text-muted-foreground truncate">
                  {CATEGORY_LABELS[course.category]}
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-xs text-foreground">
                {course.modulesCount} {t("courses.modules")} • {course.lessonsCount} {t("courses.lessons")}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(course.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <Badge variant={course.is_active ? "success" : "outline"}>
                {course.is_active ? t("courses.active") : t("courses.inactive")}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {publicCourseUrl && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    if (!course.is_active) {
                      setActivateDialogOpen(true);
                      return;
                    }
                    window.open(publicCourseUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <Eye className="size-3" />
                </Button>
              )}
              <ActionsMenu
                items={[
                  { label: t("common.edit"), onClick: () => navigate(`/admin/courses/${course.public_id}`) },
                  {
                    label: t("courses.viewPage"),
                    onClick: () => window.open(publicCourseUrl!, "_blank", "noopener,noreferrer"),
                    disabled: !publicCourseUrl,
                  },
                  { label: t("common.duplicate"), onClick: handleDuplicate, disabled: duplicating },
                  { label: course.is_active ? t("courses.deactivate") : t("courses.activate"), onClick: toggleActive },
                  { label: t("courses.deleteAction"), onClick: () => setDeleteOpen(true), destructive: true },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("courses.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t("courses.deleteConfirmDescription")}</p>
                <p
                  className="text-sm text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: t("courses.deleteConfirmInstruction", {
                      word: t("courses.deleteConfirmWord"),
                    }),
                  }}
                />
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={t("courses.deleteConfirmWord")}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={deleting || deleteConfirmText !== t("courses.deleteConfirmWord")}
              onClick={async (e) => {
                e.preventDefault();
                await handleDelete();
              }}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t("courses.deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                const { error } = await supabase
                  .from("courses")
                  .update({ is_active: true })
                  .eq("id", course.id);
                if (error) {
                  toast.error(t("courses.toggleError"));
                } else {
                  queryClient.setQueryData(["courses", tenant?.id], (old: Course[] | undefined) =>
                    old?.map((c) => (c.id === course.id ? { ...c, is_active: true } : c))
                  );
                  invalidateCourses(queryClient);
                  toast.success(t("courses.activated"));
                  if (publicCourseUrl) {
                    window.open(publicCourseUrl, "_blank", "noopener,noreferrer");
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
