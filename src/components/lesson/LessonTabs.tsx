import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LessonDescriptionTab } from "./LessonDescriptionTab";
import { LessonFilesTab } from "./LessonFilesTab";
import { LessonLinksTab } from "./LessonLinksTab";
import type { LessonDetail } from "@/hooks/useLesson";

interface LessonTabsProps {
  lesson: LessonDetail;
  tenantColor?: string;
}

export function LessonTabs({ lesson, tenantColor }: LessonTabsProps) {
  const { t } = useTranslation();

  // The "Conteúdo" tab renders only the field matching the active mode.
  // When the rich editor is selected we read lesson.content (TipTap output);
  // when HTML mode is selected we read lesson.customHtml (author-pasted raw).
  const activeContent =
    lesson.contentMode === "html" ? lesson.customHtml : lesson.content;
  const hasContent = !!activeContent;
  const hasFiles = lesson.files.length > 0;
  const hasLinks = lesson.links.length > 0;

  // Se a tab "Conteúdo" não tem nada, o default é "files" (se tiver arquivos)
  const defaultTab = hasContent ? "description" : hasFiles ? "files" : hasLinks ? "links" : "description";

  return (
    <Tabs defaultValue={defaultTab} className="mt-4">
      <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
        {hasContent && (
          <TabsTrigger
            value="description"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
          >
            {t("lessonPage.tabDescription", "Conteúdo")}
          </TabsTrigger>
        )}
        <TabsTrigger
          value="files"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm gap-1.5"
        >
          {t("lessonPage.tabFiles", "Arquivos")}
          {hasFiles && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center text-white"
              style={tenantColor ? { backgroundColor: tenantColor } : undefined}
            >
              {lesson.files.length}
            </Badge>
          )}
        </TabsTrigger>
        {hasLinks && (
          <TabsTrigger
            value="links"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm gap-1.5"
          >
            {t("lessonPage.tabLinks", "Links úteis")}
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center text-white"
              style={tenantColor ? { backgroundColor: tenantColor } : undefined}
            >
              {lesson.links.length}
            </Badge>
          </TabsTrigger>
        )}
        <TabsTrigger
          value="comments"
          disabled
          className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm opacity-40"
        >
          {t("lessonPage.tabComments", "Comentários")}
        </TabsTrigger>
      </TabsList>

      {hasContent && (
        <TabsContent value="description" className="mt-0">
          <LessonDescriptionTab
            content={lesson.content}
            customHtml={lesson.customHtml}
            contentMode={lesson.contentMode}
          />
        </TabsContent>
      )}

      <TabsContent value="files" className="mt-0">
        <LessonFilesTab files={lesson.files} />
      </TabsContent>

      {hasLinks && (
        <TabsContent value="links" className="mt-0">
          <LessonLinksTab links={lesson.links} />
        </TabsContent>
      )}
    </Tabs>
  );
}
