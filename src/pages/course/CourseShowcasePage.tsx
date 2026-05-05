import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  BookOpen,
  PlayCircle,
  Clock,
  FileText,
  ShieldX,
  Check,
  ArrowLeft,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCourseByTenantAndSlug } from "@/hooks/useCourseByTenantAndSlug";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getCoversOptimizedUrl, getLessonThumbnailOptimizedUrl } from "@/lib/storage-urls";
import { joinTitleSegments } from "@/lib/page-title";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CustomerPortalHeader } from "@/components/portal/CustomerPortalHeader";
import { TenantPublicFooter } from "@/components/tenant/TenantPublicFooter";

/* ─── Helpers ─── */

const BUTTON_RADIUS_CLASS: Record<string, string> = {
  rounded: "rounded-[8px]",
  rectangular: "rounded-none",
  pill: "rounded-[20px]",
};

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function getLessonThumbnail(lesson: {
  thumbnail_url: string | null;
  // lesson_videos has UNIQUE on lesson_id → PostgREST returns object, not array
  lesson_videos: { thumbnail_url: string | null; status: string | null } | null;
}): string | null {
  // User-uploaded thumbnail takes priority; video thumbnail is fallback
  if (lesson.thumbnail_url) {
    return getLessonThumbnailOptimizedUrl(lesson.thumbnail_url, "lesson-card");
  }
  const video = lesson.lesson_videos ?? null;
  if (video?.thumbnail_url && video.status === "ready") {
    return getLessonThumbnailOptimizedUrl(video.thumbnail_url, "lesson-card");
  }
  return null;
}

/* ─── Component ─── */

export default function CourseShowcasePage() {
  const { tenantSlug, courseSlug } = useParams<{
    tenantSlug: string;
    courseSlug: string;
  }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: course, isLoading: courseLoading } = useCourseByTenantAndSlug(
    tenantSlug,
    courseSlug
  );

  // Check access: course_customers OR tenant_users
  const { data: hasAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["course-showcase-access", course?.id, user?.id, course?.tenant_id],
    queryFn: async () => {
      // Check course_customers
      const { data: cc } = await supabase
        .from("course_customers")
        .select("id")
        .eq("course_id", course!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (cc) return true;

      // Check tenant_users
      const { data: tu } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("tenant_id", course!.tenant_id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!tu;
    },
    enabled: !!course?.id && !!user?.id && !!course?.tenant_id,
  });
  usePageTitle(course && hasAccess ? joinTitleSegments(course.title, course.tenants.name) : null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(`/${tenantSlug}/login`);
  };

  /* ─── Lesson progress (for progress bars + completion badges) ─── */
  const allLessonIds = useMemo(() => {
    if (!course) return [];
    return (course.modules ?? []).flatMap((m) =>
      (m.lessons ?? []).filter((l) => l.is_active).map((l) => l.id),
    );
  }, [course]);

  const { data: progressMap = {} } = useCourseProgress(
    course?.id,
    user?.id,
    allLessonIds,
  );

  /* ─── Loading ─── */
  if (courseLoading || accessLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ─── Course not found ─── */
  if (!course) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("courseShowcase.notFound", "Curso não encontrado")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "courseShowcase.notFoundHint",
              "Este curso não existe ou não está disponível."
            )}
          </p>
        </div>
      </div>
    );
  }

  /* ─── Access denied ─── */
  if (!hasAccess) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background gap-6 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldX className="size-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">
            {t("courseShowcase.accessDenied", "Acesso negado")}
          </h1>
          <p className="text-muted-foreground max-w-md">
            {t(
              "courseShowcase.accessDeniedHint",
              "Você não tem acesso a este curso. Entre em contato com o produtor para obter acesso."
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/${tenantSlug}/store`}>
            {t("courseShowcase.backToStore", "Voltar para a loja")}
          </Link>
        </Button>
      </div>
    );
  }

  /* ─── Prepare data ─── */
  const tenant = course.tenants;
  const coverUrl = course.cover_horizontal_url
    ? getCoversOptimizedUrl(course.cover_horizontal_url, "cover-hero", course.updated_at)
    : null;

  const sortedModules = [...(course.modules || [])]
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .map((mod) => ({
      ...mod,
      lessons: [...(mod.lessons || [])]
        .filter((l) => l.is_active)
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)),
    }));

  const totalLessons = sortedModules.reduce(
    (sum, mod) => sum + mod.lessons.length,
    0
  );
  const totalDuration = sortedModules.reduce(
    (sum, mod) =>
      sum + mod.lessons.reduce((s, l) => s + (l.duration_seconds || 0), 0),
    0
  );

  const tenantColor =
    tenant?.tenant_settings?.primary_color ??
    tenant?.tenant_settings?.icon_color ??
    undefined;
  const backButtonRadiusClass =
    BUTTON_RADIUS_CLASS[tenant?.tenant_settings?.portal_button_style || "rounded"] ||
    BUTTON_RADIUS_CLASS.rounded;
  const backToPortalLabel = t("courseShowcase.backToPortal", "Voltar ao portal");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ═══ Header ═══ */}
      <CustomerPortalHeader
        tenantName={tenant.name}
        tenantSlug={tenantSlug!}
        tenantIconUrl={tenant.tenant_settings?.icon_url}
        tenantIconName={tenant.tenant_settings?.icon_name}
        tenantIconColor={tenant.tenant_settings?.icon_color}
        onSignOut={handleSignOut}
        showPortalLink
        userId={user?.id}
      />

      {/* ═══ Content (flex-1 pushes footer down) ═══ */}
      <div className="flex-1">

      {/* ═══ Hero ═══ */}
      <div className="relative w-full px-4 md:px-8">
        <div className="mx-auto max-w-[1200px] 3xl:max-w-[1600px]">
          {/* Image + overlay container */}
          <div className="relative overflow-hidden sm:rounded-b-2xl">
            {/* Back button — always on top of image */}
            <Link
              to={`/${tenantSlug}`}
              aria-label={backToPortalLabel}
              title={backToPortalLabel}
              className={cn(
                "absolute left-4 top-4 z-10 flex size-9 items-center justify-center bg-black/20 text-white/90 shadow-none backdrop-blur-sm transition-colors hover:bg-black/[0.28] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 sm:left-8 sm:top-7 sm:size-10",
                backButtonRadiusClass,
              )}
            >
              <ArrowLeft className="size-4 sm:size-[18px]" />
            </Link>

            {/* Cover image — same 3:1 crop on all sizes */}
            <div className="aspect-[3/1] sm:max-h-[400px] 3xl:max-h-none">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={course.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="size-full bg-[#161b22]" />
              )}
            </div>

            {/* Desktop overlay — hidden on mobile */}
            <div className="hidden sm:flex absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent items-end">
              <div className="p-8 max-w-3xl">
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  {course.title}
                </h1>
                {course.description && (
                  <p className="mt-2 text-base text-white/80 max-w-2xl">
                    {course.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  {sortedModules.length > 0 && (
                    <span className="text-sm text-white/60 flex items-center gap-1.5">
                      <BookOpen className="size-4" />
                      {sortedModules.length}{" "}
                      {sortedModules.length === 1 ? "módulo" : "módulos"}
                    </span>
                  )}
                  {totalLessons > 0 && (
                    <span className="text-sm text-white/60 flex items-center gap-1.5">
                      <PlayCircle className="size-4" />
                      {totalLessons}{" "}
                      {totalLessons === 1 ? "aula" : "aulas"}
                    </span>
                  )}
                  {totalDuration > 0 && (
                    <span className="text-sm text-white/60 flex items-center gap-1.5">
                      <Clock className="size-4" />
                      {formatDuration(totalDuration)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile text — below image, visible only on mobile */}
          <div className="sm:hidden px-4 pt-5 pb-2">
            <h1 className="text-2xl font-bold text-foreground">
              {course.title}
            </h1>
            {course.description && (
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                {course.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {sortedModules.length > 0 && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="size-4" />
                  {sortedModules.length}{" "}
                  {sortedModules.length === 1 ? "módulo" : "módulos"}
                </span>
              )}
              {totalLessons > 0 && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <PlayCircle className="size-4" />
                  {totalLessons}{" "}
                  {totalLessons === 1 ? "aula" : "aulas"}
                </span>
              )}
              {totalDuration > 0 && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-4" />
                  {formatDuration(totalDuration)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Modules & Lessons ═══ */}
      <div className="w-full px-4 md:px-8 py-8 sm:py-10">
      <div className="mx-auto max-w-[1200px] 3xl:max-w-[1600px]">
        {!sortedModules.length ? (
          <p className="text-muted-foreground text-center py-12">
            {t(
              "courseShowcase.noContent",
              "O conteúdo deste curso ainda está sendo preparado."
            )}
          </p>
        ) : (
          <div className="space-y-10">
            {sortedModules.map((mod, modIndex) => (
              <section key={mod.id}>
                {/* Module header */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                    {modIndex + 1}
                  </span>
                  <h2 className="text-lg font-semibold text-foreground">
                    {mod.title}
                  </h2>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {mod.lessons.length}{" "}
                    {mod.lessons.length === 1 ? "aula" : "aulas"}
                  </span>
                </div>

                {/* Lessons gallery */}
                {mod.lessons.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {mod.lessons.map((lesson) => {
                      const thumb = getLessonThumbnail(lesson);
                      const hasFiles = lesson.lesson_assets_link?.length > 0;
                      // lesson_videos is an object (UNIQUE on lesson_id), not an array
                      const hasVideo = lesson.lesson_videos != null;

                      // Progress data
                      const progress = progressMap[lesson.id];
                      const isCompleted = !!progress?.completed;
                      const durationSec = lesson.duration_seconds ?? 0;
                      const progressSec = progress?.progress_seconds ?? 0;
                      const progressPct =
                        hasVideo && durationSec > 0
                          ? Math.min((progressSec / durationSec) * 100, 100)
                          : 0;
                      const showProgressBar = hasVideo && durationSec > 0 && progressSec > 0;

                      return (
                        <Link
                          to={`/${tenantSlug}/${courseSlug}/${lesson.public_id}`}
                          key={lesson.id}
                          className="group rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-foreground/20"
                        >
                          {/* Thumbnail */}
                          <div className="relative aspect-video bg-muted overflow-hidden">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={lesson.title}
                                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="size-full flex items-center justify-center">
                                {hasVideo ? (
                                  <PlayCircle className="size-8 text-muted-foreground/30" />
                                ) : hasFiles ? (
                                  <FileText className="size-8 text-muted-foreground/30" />
                                ) : (
                                  <BookOpen className="size-8 text-muted-foreground/30" />
                                )}
                              </div>
                            )}
                            {/* Duration badge */}
                            {lesson.duration_seconds != null &&
                              lesson.duration_seconds > 0 && (
                                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  {formatDuration(lesson.duration_seconds)}
                                </span>
                              )}
                            {/* Completion badge */}
                            {isCompleted && (
                              <span className="absolute top-2 right-2 flex items-center justify-center size-5 rounded-full bg-emerald-500 shadow-sm">
                                <Check className="size-3 text-white" strokeWidth={3} />
                              </span>
                            )}
                            {/* Progress bar overlay at bottom of thumbnail */}
                            {showProgressBar && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                                <div
                                  className="h-full transition-all duration-300"
                                  style={{
                                    width: `${progressPct}%`,
                                    backgroundColor:
                                      tenantColor || "hsl(var(--primary))",
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Title */}
                          <div className="px-3 py-2.5">
                            <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                              {lesson.title}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    {t(
                      "courseShowcase.noLessons",
                      "Nenhuma aula neste módulo."
                    )}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
      </div>
      </div>

      <TenantPublicFooter
        className="mt-16"
        tenantName={tenant.name}
        socialLinks={tenant.tenant_settings?.social_links ?? null}
      />
    </div>
  );
}
