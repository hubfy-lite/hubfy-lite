import { useState } from "react";
import { Download, FileText, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize } from "@/lib/format";
import type { LessonFileAsset } from "@/hooks/useLesson";

interface LessonFilesTabProps {
  files: LessonFileAsset[];
}

export function LessonFilesTab({ files }: LessonFilesTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!files.length) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        {t("lessonPage.noFiles", "Nenhum arquivo disponível.")}
      </p>
    );
  }

  const handleDownload = async (file: LessonFileAsset) => {
    if (!file.asset?.file) return;
    const { bucket, object_path, original_filename } = file.asset.file;

    setDownloading(file.id);
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(object_path, 3600, { download: original_filename });

      if (error || !data?.signedUrl) {
        throw error || new Error("No signed URL");
      }

      // Trigger download
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast({
        title: t("lessonPage.downloadError", "Erro ao gerar link de download."),
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="divide-y divide-border py-2">
      {files.map((file) => {
        if (!file.asset) return null;
        const isDownloading = downloading === file.id;

        return (
          <div
            key={file.id}
            className="flex items-center gap-3 py-3"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {file.label || file.asset.file?.original_filename || file.asset.title}
              </p>
              {file.asset.size_bytes != null && (
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.asset.size_bytes)}
                </p>
              )}
            </div>
            {!file.asset.file ? (
              <span className="text-xs text-muted-foreground">
                {t("lessonPage.fileUnavailable", "Arquivo indisponível")}
              </span>
            ) : file.asset.status !== 'ready' ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {file.asset.status === 'failed' ? (
                  <>
                    <AlertCircle className="size-3.5" />
                    {t("lessonPage.fileFailed", "Falha no processamento")}
                  </>
                ) : (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("lessonPage.fileProcessing", "Processando...")}
                  </>
                )}
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isDownloading}
                onClick={() => handleDownload(file)}
              >
                {isDownloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">
                  {t("lessonPage.download", "Baixar")}
                </span>
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
