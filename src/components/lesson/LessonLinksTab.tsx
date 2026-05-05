import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LessonLinkItem } from "@/hooks/useLesson";

interface LessonLinksTabProps {
  links: LessonLinkItem[];
}

export function LessonLinksTab({ links }: LessonLinksTabProps) {
  const { t } = useTranslation();

  if (!links.length) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        {t("lessonPage.noLinks", "Nenhum link disponível.")}
      </p>
    );
  }

  return (
    <div className="divide-y divide-border py-2">
      {links.map((link, index) => {
        const title = link.label || link.displayUrl || link.url;
        const subtitle = link.displayUrl || link.url;
        // Only show subtitle if it's different from the title
        const showSubtitle = subtitle !== title;

        return (
          <a
            key={index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-3 group hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <ExternalLink className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate group-hover:underline">
                {title}
              </p>
              {showSubtitle && (
                <p className="text-xs text-muted-foreground truncate">
                  {subtitle}
                </p>
              )}
            </div>
            <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </a>
        );
      })}
    </div>
  );
}
