import { useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldX, BookOpen, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCourseByTenantAndSlug } from "@/hooks/useCourseByTenantAndSlug";
import { useLesson } from "@/hooks/useLesson";
import { useHostingVideoToken } from "@/hooks/useHostingVideoToken";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { usePageTitle } from "@/hooks/usePageTitle";
import { joinTitleSegments } from "@/lib/page-title";
import { LessonVideoPlayer } from "@/components/lesson/LessonVideoPlayer";
import { LessonTabs } from "@/components/lesson/LessonTabs";
import { LessonCourseSidebar } from "@/components/lesson/LessonCourseSidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CustomerPortalHeader } from "@/components/portal/CustomerPortalHeader";
import { TenantPublicFooter } from "@/components/tenant/TenantPublicFooter";

export default function LessonPage() {
  const { tenantSlug, courseSlug, lessonId } = useParams<{
    tenantSlug: string;
    courseSlug: string;
    lessonId: string;
  }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Course data (for sidebar navigation + access check)
  const { data: course, isLoading: courseLoading } = useCourseByTenantAndSlug(
    tenantSlug,
    courseSlug
  );

  // Lesson data (video, description, files)
  // placeholderData: keepPreviousData → keeps previous lesson while new one loads
  const { data: lesson, isLoading: lessonLoading, isFetching: lessonFetching } = useLesson(lessonId);
  const hasCurrentLesson = lesson?.public_id === lessonId;

  // Access check (same as CourseShowcasePage)
  const { data: hasAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["course-showcase-access", course?.id, user?.id, course?.tenant_id],
    queryFn: async () => {
      const { data: cc } = await supabase
        .from("course_customers")
        .select("id")
        .eq("course_id", course!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (cc) return true;

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
  usePageTitle(
    course && hasAccess && hasCurrentLesson && lesson
      ? joinTitleSegments(course.title, lesson.title, course.tenants.name)
      : null,
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(`/${tenantSlug}/login`);
  };

  /* ─── Prepare video data ─── */
  const tenant = course?.tenants;
  const video = lesson?.video;
  const isGumlet = video?.provider === "gumlet";
  const gumletAssetId =
    isGumlet && video?.status === "ready"
      ? video.provider_asset_id
      : null;
  const tenantPlan = tenant?.tenant_settings?.plan ?? "free";
  const isPro = tenantPlan === "pro" || tenantPlan === "business";
  const videoProtectionEnabled =
    tenant?.tenant_settings?.video_protection_enabled ?? false;
  const progressTrackingEnabled =
    isGumlet && (tenant?.tenant_settings?.video_progress_tracking_enabled ?? false);

  // Resolve hosted-video embed URL (signed or plain, depending on tenant plan)
  const {
    embedUrl: gumletEmbedUrl,
    isLoading: videoLoading,
  } = useHostingVideoToken({
    lessonId: lesson?.id,
    hostingAssetId: gumletAssetId,
    videoProtectionEnabled,
    videoSettings: tenant?.tenant_settings?.video_settings,
    fallbackColor:
      tenant?.tenant_settings?.icon_color ??
      tenant?.tenant_settings?.primary_color,
    captionsEnabled: isPro,
  });

  // Unified embed URL: Gumlet uses signed URL, others use playback_url directly
  const embedUrl = useMemo(() => {
    if (!video) return gumletEmbedUrl ?? null;
    if (isGumlet) return gumletEmbedUrl;
    return video.playback_url;
  }, [video, isGumlet, gumletEmbedUrl]);

  /* ─── Lesson progress (completion toggle) ─── */
  const queryClient = useQueryClient();

  const allLessonIds = useMemo(() => {
    if (!course) return [];
    return (course.modules ?? []).flatMap((m) =>
      (m.lessons ?? []).filter((l) => l.is_active).map((l) => l.id),
    );
  }, [course]);

  const { data: progressMap = {}, isLoading: progressLoading } = useCourseProgress(
    course?.id,
    user?.id,
    allLessonIds,
  );

  const handleToggleComplete = useCallback(
    async (targetLessonId: string, completed: boolean) => {
      if (!user?.id) return;
      await supabase.from("lesson_progress").upsert(
        {
          lesson_id: targetLessonId,
          user_id: user.id,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lesson_id,user_id" },
      );
      queryClient.invalidateQueries({
        queryKey: ["course-progress", course?.id, user.id],
      });
    },
    [user?.id, course?.id, queryClient],
  );

  /* ─── Initial loading (course / access / progress — only first load) ─── */
  const isInitialLoad = courseLoading || accessLoading || progressLoading || (lessonLoading && !lesson);
  if (isInitialLoad) {
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
            {t("courseShowcase.notFoundHint", "Este curso não existe ou não está disponível.")}
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
            {t("courseShowcase.accessDeniedHint", "Você não tem acesso a este curso. Entre em contato com o produtor para obter acesso.")}
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

  /* ─── Lesson not found ─── */
  if (!lesson) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background gap-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <BookOpen className="size-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">
            {t("lessonPage.notFound", "Aula não encontrada")}
          </h1>
          <p className="text-muted-foreground max-w-md">
            {t("lessonPage.notFoundHint", "Esta aula não existe ou não está disponível.")}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/${tenantSlug}/${courseSlug}`}>
            {t("lessonPage.backToCourse", "Voltar ao curso")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ═══ Header ═══ */}
      <CustomerPortalHeader
        tenantName={tenant!.name}
        tenantSlug={tenantSlug!}
        tenantIconUrl={tenant!.tenant_settings?.icon_url}
        tenantIconName={tenant!.tenant_settings?.icon_name}
        tenantIconColor={tenant!.tenant_settings?.icon_color}
        onSignOut={handleSignOut}
        showPortalLink
        userId={user?.id}
        brandingHref={`/${tenantSlug}/${courseSlug}`}
      />

      {/* ═══ Content ═══ */}
      <div className="flex-1 w-full px-4 md:px-8 py-4">
      <div className="mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px]">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
          <Link
            to={`/${tenantSlug}/${courseSlug}`}
            className="hover:text-foreground transition-colors truncate max-w-[220px]"
          >
            {course.title}
          </Link>
          <ChevronRight className="size-3.5 shrink-0" />
          <span className="text-foreground font-medium truncate">{lesson.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ── Left: Video + Tabs (60%) ── */}
          <div className={cn(
            "w-full min-w-0 lg:col-span-3 transition-opacity duration-200",
            lessonFetching ? "opacity-60" : "opacity-100"
          )}>
            {lesson.video && (
              <LessonVideoPlayer
                key={lessonId}
                embedUrl={embedUrl}
                title={lesson.title}
                isLoading={videoLoading || lessonFetching}
                lessonId={lesson?.id}
                userId={user?.id}
                trackingEnabled={progressTrackingEnabled}
                startTimeSeconds={
                  progressMap[lesson?.id!]?.completed
                    ? 0
                    : (progressMap[lesson?.id!]?.progress_seconds ?? 0)
                }
              />
            )}

            {/* Lesson title (desktop) — spacing only needed when the video sits above */}
            <h1
              className={cn(
                "text-lg font-semibold text-foreground hidden lg:block",
                lesson.video && "mt-4"
              )}
            >
              {lesson.title}
            </h1>

            <LessonTabs
              lesson={lesson}
              tenantColor={tenant!.tenant_settings?.icon_color ?? undefined}
            />
          </div>

          {/* ── Right: Course sidebar (40%) ── */}
          <div className="w-full min-w-0 lg:col-span-2">
            <div className="lg:sticky lg:top-[72px]">
              <LessonCourseSidebar
                course={course}
                currentLessonId={lessonId!}
                tenantSlug={tenantSlug!}
                courseSlug={courseSlug!}
                progressMap={progressMap}
                onToggleComplete={handleToggleComplete}
                tenantColor={tenant?.tenant_settings?.primary_color ?? tenant?.tenant_settings?.icon_color ?? undefined}
              />
            </div>
          </div>
        </div>
      </div>
      </div>

      <TenantPublicFooter
        className="mt-16"
        tenantName={tenant!.name}
        socialLinks={tenant!.tenant_settings?.social_links ?? null}
      />
    </div>
  );
}
