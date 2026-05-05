import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { sanitizeLessonHtml } from "@/lib/sanitize-lesson-html";

interface LessonDescriptionTabProps {
  /** Rich editor output (TipTap). Used when contentMode === 'rich'. */
  content: string | null;
  /** Raw HTML pasted by the author. Used when contentMode === 'html'. */
  customHtml: string | null;
  contentMode: "rich" | "html";
}

export function LessonDescriptionTab({
  content,
  customHtml,
  contentMode,
}: LessonDescriptionTabProps) {
  const { t } = useTranslation();

  // Only the field matching the active mode is ever rendered — the other
  // one stays in the DB but is invisible to students.
  const activeSource = contentMode === "html" ? customHtml : content;

  const sanitizedContent = useMemo(
    () => (activeSource ? sanitizeLessonHtml(activeSource) : null),
    [activeSource]
  );

  if (!sanitizedContent) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        {t("lessonPage.noDescription", "Nenhuma descrição disponível.")}
      </p>
    );
  }

  return (
    <div className="py-4">
      <div
        className="prose prose-sm dark:prose-invert max-w-none prose-p:text-neutral-700 dark:prose-p:text-neutral-300 prose-li:text-neutral-700 dark:prose-li:text-neutral-300 prose-headings:text-neutral-800 dark:prose-headings:text-neutral-200 prose-strong:text-neutral-800 dark:prose-strong:text-neutral-200"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    </div>
  );
}
