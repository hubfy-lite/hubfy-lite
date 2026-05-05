import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, GripVertical, X, Search, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/components/ui/sortable";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABELS, type CourseCategory } from "@/lib/course-categories";
import { limitNameLength } from "@/lib/name-limits";

// ─── Types ────────────────────────────────────────────────

interface RawLesson { id: string }
interface RawModule { id: string; lessons: RawLesson[] }
interface RawCourse {
  id: string;
  title: string;
  cover_horizontal_url: string | null;
  updated_at: string;
  category: CourseCategory | null;
  is_active: boolean;
  modules: RawModule[];
}
interface RawShowcaseCourse {
  id: string;
  course_id: string;
  sort_order: number;
  courses: RawCourse | null;
}

interface CourseRow {
  id: string;
  title: string;
  cover_horizontal_url: string | null;
  updated_at: string;
  category: CourseCategory | null;
  is_active: boolean;
  modulesCount: number;
  lessonsCount: number;
}

const ADMIN_IMAGE_PLACEHOLDER = "/images/placeholder.svg";

/** A course linked to a showcase (from showcase_courses join) */
export interface LinkedCourse {
  /** showcase_courses.id — undefined for newly added (not yet in DB) */
  scId?: string;
  course: CourseRow;
}

interface ShowcaseCoursesSectionProps {
  showcaseId: string;
  tenantId: string;
  onDirtyChange: (dirty: boolean) => void;
  registerSave: (saveFn: () => Promise<void>) => void;
  onCoursesChange?: (courses: LinkedCourse[]) => void;
}

// ─── Component ────────────────────────────────────────────

export function ShowcaseCoursesSection({
  showcaseId,
  tenantId,
  onDirtyChange,
  registerSave,
  onCoursesChange,
}: ShowcaseCoursesSectionProps) {
  const { t } = useTranslation();

  // All tenant courses (for the available list)
  const [allCourses, setAllCourses] = useState<CourseRow[]>([]);

  // Courses currently linked to this showcase (local state)
  const [linkedCourses, setLinkedCourses] = useState<LinkedCourse[]>([]);
  // Snapshot of what's in the DB — used for dirty check + diff on save
  const [initialLinked, setInitialLinked] = useState<LinkedCourse[]>([]);

  const [search, setSearch] = useState("");

  // ─── Load data ────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return;

    const loadAllCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, cover_horizontal_url, updated_at, category, is_active, modules(id, lessons(id))")
        .eq("tenant_id", tenantId)
        .order("title");

      if (data) {
        setAllCourses((data as RawCourse[]).map((c) => ({
          id: c.id,
          title: limitNameLength(c.title),
          cover_horizontal_url: c.cover_horizontal_url,
          updated_at: c.updated_at,
          category: c.category,
          is_active: c.is_active,
          modulesCount: c.modules?.length ?? 0,
          lessonsCount: c.modules?.reduce((sum: number, m: RawModule) => sum + (m.lessons?.length ?? 0), 0) ?? 0,
        })));
      }
    };

    loadAllCourses();
  }, [tenantId]);

  useEffect(() => {
    if (!showcaseId) return;

    const loadLinked = async () => {
      const { data } = await supabase
        .from("showcase_courses")
        .select("id, course_id, sort_order, courses(id, title, cover_horizontal_url, updated_at, category, is_active, modules(id, lessons(id)))")
        .eq("showcase_id", showcaseId)
        .order("sort_order");

      if (data) {
        const mapped: LinkedCourse[] = (data as RawShowcaseCourse[])
          .filter((row) => row.courses)
          .map((row) => {
            const c = row.courses!;
            return {
              scId: row.id,
              course: {
                id: c.id,
                title: limitNameLength(c.title),
                cover_horizontal_url: c.cover_horizontal_url,
                updated_at: c.updated_at,
                category: c.category,
                is_active: c.is_active,
                modulesCount: c.modules?.length ?? 0,
                lessonsCount: c.modules?.reduce((sum: number, m: RawModule) => sum + (m.lessons?.length ?? 0), 0) ?? 0,
              },
            };
          });
        setLinkedCourses(mapped);
        setInitialLinked(mapped);
      }
    };

    loadLinked();
  }, [showcaseId]);

  // ─── Dirty state ──────────────────────────────────────

  const hasChanges = useMemo(() => {
    if (linkedCourses.length !== initialLinked.length) return true;
    return linkedCourses.some(
      (lc, i) => lc.course.id !== initialLinked[i]?.course.id
    );
  }, [linkedCourses, initialLinked]);

  useEffect(() => {
    onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  // Emit linkedCourses to parent for live preview
  useEffect(() => {
    onCoursesChange?.(linkedCourses);
  }, [linkedCourses, onCoursesChange]);

  // ─── Save function (registered with modal) ───────────

  const saveRef = useRef(linkedCourses);
  saveRef.current = linkedCourses;
  const initialRef = useRef(initialLinked);
  initialRef.current = initialLinked;

  const save = useCallback(async () => {
    const current = saveRef.current;
    const initial = initialRef.current;

    const initialIds = new Set(initial.map((lc) => lc.course.id));
    const currentIds = new Set(current.map((lc) => lc.course.id));

    // New links to insert
    const toInsert = current.filter((lc) => !initialIds.has(lc.course.id));
    // Links to delete
    const toDelete = initial.filter((lc) => !currentIds.has(lc.course.id));
    // Links that still exist — update sort_order
    const toUpdate = current.filter((lc) => lc.scId && initialIds.has(lc.course.id));

    // Delete removed
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((lc) => lc.scId!).filter(Boolean);
      if (deleteIds.length > 0) {
        await supabase
          .from("showcase_courses")
          .delete()
          .in("id", deleteIds);
      }
    }

    // Insert new
    if (toInsert.length > 0) {
      const insertPayload = toInsert.map((lc, i) => ({
        showcase_id: showcaseId,
        course_id: lc.course.id,
        sort_order: current.indexOf(lc),
      }));
      await supabase.from("showcase_courses").insert(insertPayload);
    }

    // Update sort_order for existing
    if (toUpdate.length > 0) {
      const updatePayload = toUpdate.map((lc) => ({
        id: lc.scId!,
        sort_order: current.indexOf(lc),
        showcase_id: showcaseId,
        course_id: lc.course.id,
      }));
      await supabase.from("showcase_courses").upsert(updatePayload);
    }

    // Reload from DB to get fresh scIds
    const { data } = await supabase
      .from("showcase_courses")
      .select("id, course_id, sort_order, courses(id, title, cover_horizontal_url, updated_at, category, is_active, modules(id, lessons(id)))")
      .eq("showcase_id", showcaseId)
      .order("sort_order");

    if (data) {
      const mapped: LinkedCourse[] = (data as RawShowcaseCourse[])
        .filter((row) => row.courses)
        .map((row) => {
          const c = row.courses!;
          return {
            scId: row.id,
            course: {
              id: c.id,
              title: limitNameLength(c.title),
              cover_horizontal_url: c.cover_horizontal_url,
              updated_at: c.updated_at,
              category: c.category,
              is_active: c.is_active,
              modulesCount: c.modules?.length ?? 0,
              lessonsCount: c.modules?.reduce((sum: number, m: RawModule) => sum + (m.lessons?.length ?? 0), 0) ?? 0,
            },
          };
        });
      setLinkedCourses(mapped);
      setInitialLinked(mapped);
    }
  }, [showcaseId]);

  useEffect(() => {
    registerSave(save);
  }, [save, registerSave]);

  // ─── Actions ──────────────────────────────────────────

  const addCourse = (course: CourseRow) => {
    if (linkedCourses.some((lc) => lc.course.id === course.id)) return;
    setLinkedCourses((prev) => [...prev, { course }]);
  };

  const removeCourse = (courseId: string) => {
    setLinkedCourses((prev) => prev.filter((lc) => lc.course.id !== courseId));
  };

  // ─── Derived ──────────────────────────────────────────

  const linkedIds = new Set(linkedCourses.map((lc) => lc.course.id));
  const availableCourses = allCourses.filter((c) => !linkedIds.has(c.id));
  const filteredAvailable = search
    ? availableCourses.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : availableCourses;

  // ─── Render helpers ───────────────────────────────────

  const renderCourseItem = (lc: LinkedCourse, isDragOverlay = false) => (
    <Item variant="outline" className={isDragOverlay ? "shadow-lg" : undefined}>
      <SortableItemHandle className="text-muted-foreground hover:text-foreground">
        <GripVertical className="size-4" />
      </SortableItemHandle>
      <ItemMedia variant="image" className="rounded-md">
        {lc.course.cover_horizontal_url ? (
          <img
            src={getCoversOptimizedUrl(
              lc.course.cover_horizontal_url,
              "admin-card-wide",
              lc.course.updated_at
            )}
            alt={lc.course.title}
            className="size-full object-cover"
          />
        ) : (
          <img
            src={ADMIN_IMAGE_PLACEHOLDER}
            alt=""
            className="size-full object-cover opacity-70"
          />
        )}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{lc.course.title}</ItemTitle>
        <ItemDescription>
          {[
            lc.course.category && CATEGORY_LABELS[lc.course.category],
            `${lc.course.modulesCount} ${t("courses.modules")} • ${lc.course.lessonsCount} ${t("courses.lessons")}`,
          ].filter(Boolean).join(" · ")}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {!isDragOverlay && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => removeCourse(lc.course.id)}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </ItemActions>
    </Item>
  );

  // ─── Render ───────────────────────────────────────────

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t("showcaseEdit.courses.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SEÇÃO 1: Cursos vinculados (com drag-and-drop) */}
        {linkedCourses.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              {t("showcaseEdit.courses.linked")}
            </h4>
            <Sortable
              value={linkedCourses}
              onValueChange={setLinkedCourses}
              getItemValue={(lc) => lc.course.id}
              orientation="vertical"
            >
              <SortableContent className="space-y-2">
                {linkedCourses.map((lc) => (
                  <SortableItem key={lc.course.id} value={lc.course.id} asChild>
                    {renderCourseItem(lc)}
                  </SortableItem>
                ))}
              </SortableContent>
              <SortableOverlay>
                {({ value }) => {
                  const lc = linkedCourses.find((l) => l.course.id === value);
                  return lc ? renderCourseItem(lc, true) : null;
                }}
              </SortableOverlay>
            </Sortable>
          </div>
        )}

        {/* SEÇÃO 2: Adicionar cursos (busca + lista inline) */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            {t("showcaseEdit.courses.addCourses")}
          </h4>

          {/* Barra de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t("showcaseEdit.courses.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de cursos disponíveis */}
          <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
            {allCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="size-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("showcaseEdit.courses.noCourses")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("showcaseEdit.courses.noCoursesHint")}
                </p>
              </div>
            ) : filteredAvailable.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="size-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {search
                    ? t("showcaseEdit.courses.noResults")
                    : t("showcaseEdit.courses.allAdded")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredAvailable.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                  >
                    {/* Capa do curso */}
                    <div className="h-10 w-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                      {course.cover_horizontal_url ? (
                        <img
                          src={getCoversOptimizedUrl(
                            course.cover_horizontal_url,
                            "admin-card-wide",
                            course.updated_at
                          )}
                          alt={course.title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <img
                          src={ADMIN_IMAGE_PLACEHOLDER}
                          alt=""
                          className="size-full object-cover opacity-70"
                        />
                      )}
                    </div>
                    {/* Título + Metadata */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          course.category && CATEGORY_LABELS[course.category],
                          `${course.modulesCount} ${t("courses.modules")} • ${course.lessonsCount} ${t("courses.lessons")}`,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {/* Botão de adicionar */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => addCourse(course)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
