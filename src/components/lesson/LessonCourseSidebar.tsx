import { Link } from "react-router-dom";
import { PlayCircle, FileText, BookOpen, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { getLessonThumbnailOptimizedUrl } from "@/lib/storage-urls";
import type { CourseShowcaseData } from "@/hooks/useCourseByTenantAndSlug";
import type { LessonProgressMap } from "@/hooks/useCourseProgress";

interface LessonCourseSidebarProps {
  course: CourseShowcaseData;
  currentLessonId: string;
  tenantSlug: string;
  courseSlug: string;
  progressMap?: LessonProgressMap;
  onToggleComplete?: (lessonId: string, completed: boolean) => void;
  tenantColor?: string;
}

export function LessonCourseSidebar({
  course,
  currentLessonId,
  tenantSlug,
  courseSlug,
  progressMap = {},
  onToggleComplete,
  tenantColor,
}: LessonCourseSidebarProps) {
  const { t } = useTranslation();

  const sortedModules = [...(course.modules || [])]
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .map((mod) => ({
      ...mod,
      lessons: [...(mod.lessons || [])]
        .filter((l) => l.is_active)
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)),
    }));

  // All modules open by default
  const allModuleIds = sortedModules.map((m) => m.id);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <Link
          to={`/${tenantSlug}/${courseSlug}`}
          className="text-sm font-semibold text-foreground hover:underline line-clamp-1"
        >
          {course.title}
        </Link>
      </div>

      {/* Modules list */}
      <ScrollArea className="max-h-[calc(100dvh-200px)]">
        <Accordion
          type="multiple"
          defaultValue={allModuleIds}
          className="w-full"
        >
          {sortedModules.map((mod, modIndex) => (
            <AccordionItem key={mod.id} value={mod.id} className="border-b border-border/50 last:border-b-0">
              <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/50 text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                    {modIndex + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {mod.title}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2 pt-0">
                <div className="flex flex-col gap-0.5">
                  {mod.lessons.map((lesson) => {
                    const isCurrent = lesson.public_id === currentLessonId;
                    const video = lesson.lesson_videos ?? null;
                    const hasVideo = lesson.lesson_videos != null;
                    const hasFiles = lesson.lesson_assets_link?.length > 0;
                    // User-uploaded thumbnail takes priority; video thumbnail is fallback
                    const thumbUrl =
                      getLessonThumbnailOptimizedUrl(lesson.thumbnail_url, "lesson-thumb") ??
                      (video?.status === "ready"
                        ? getLessonThumbnailOptimizedUrl(video.thumbnail_url, "lesson-thumb")
                        : null) ??
                      null;

                    const progress = progressMap[lesson.id];
                    const isCompleted = !!progress?.completed;

                    // Progress bar: só mostra se tem vídeo com duração
                    const durationSec = lesson.duration_seconds ?? 0;
                    const progressSec = progress?.progress_seconds ?? 0;
                    const progressPct =
                      hasVideo && durationSec > 0
                        ? Math.min((progressSec / durationSec) * 100, 100)
                        : 0;
                    const showProgressBar = hasVideo && durationSec > 0 && progressSec > 0;

                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 mx-1 rounded-lg transition-colors",
                          isCurrent
                            ? "bg-primary/10"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Link
                          to={`/${tenantSlug}/${courseSlug}/${lesson.public_id}`}
                          className="flex items-center gap-2.5 flex-1 min-w-0"
                        >
                          {/* Thumbnail + progress bar */}
                          <div className="shrink-0 w-28">
                            <div className="relative aspect-video rounded overflow-hidden bg-muted flex items-center justify-center">
                              {thumbUrl ? (
                                <img
                                  src={thumbUrl}
                                  alt={lesson.title}
                                  className="w-full h-full object-contain object-center"
                                />
                              ) : (
                                <span className="text-muted-foreground/50">
                                  {hasVideo ? (
                                    <PlayCircle className="size-5" />
                                  ) : hasFiles ? (
                                    <FileText className="size-5" />
                                  ) : (
                                    <BookOpen className="size-5" />
                                  )}
                                </span>
                              )}

                              {/* Progress bar overlay at bottom of thumbnail */}
                              {showProgressBar && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                                  <div
                                    className="h-full transition-all duration-300"
                                    style={{
                                      width: `${progressPct}%`,
                                      backgroundColor: tenantColor || "hsl(var(--primary))",
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Title + duration */}
                          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                            <span
                              className={cn(
                                "text-xs leading-snug line-clamp-2 font-medium",
                                isCurrent ? "text-primary" : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {lesson.title}
                            </span>
                            {lesson.duration_seconds != null && lesson.duration_seconds > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatDuration(lesson.duration_seconds)}
                              </span>
                            )}
                          </div>
                        </Link>

                        {/* Completion toggle — right side */}
                        <button
                          type="button"
                          aria-label={isCompleted ? "Marcar como não concluída" : "Marcar como concluída"}
                          className="shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleComplete?.(lesson.id, !isCompleted);
                          }}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-center size-5 rounded-full border-2 transition-colors",
                              isCompleted
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-muted-foreground/30 hover:border-muted-foreground/60"
                            )}
                          >
                            {isCompleted && (
                              <Check className="size-3 text-white dark:text-black" strokeWidth={3} />
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
