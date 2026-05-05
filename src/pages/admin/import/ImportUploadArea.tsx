import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ImportUploadAreaProps {
  filename: string;
  maxRows: number;
  ns: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

export function ImportUploadArea({
  filename,
  maxRows,
  ns,
  onFileChange,
  onReset,
}: ImportUploadAreaProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card variant="bordered">
      <CardContent className="pt-6">
        <div
          className="relative flex h-[140px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border px-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {filename ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
              <img src="/assets/csv.svg" alt="CSV" className="size-10" />
              <div>
                <p className="text-sm font-medium text-foreground">{filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(`${ns}.uploadHint`, { max: maxRows })}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
                <FileSpreadsheet className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t(`${ns}.uploadCsv`)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(`${ns}.uploadHint`, { max: maxRows })}
                </p>
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onFileChange}
        />
      </CardContent>
    </Card>
  );
}
