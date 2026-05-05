import { Check, Loader2, AlertCircle, X, Film, FileText } from "lucide-react";
import { useUploadContext, type UploadItem } from "@/contexts/UploadContext";

function UploadItemRow({ item }: { item: UploadItem }) {
  const isActive = item.status === "uploading";
  const isDone = item.status === "ready";
  const isProcessing = item.status === "processing";
  const isFailed = item.status === "failed";

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      {/* Icon */}
      <div className="shrink-0">
        {item.type === "video" ? (
          <Film className="size-3.5 text-muted-foreground" />
        ) : (
          <FileText className="size-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
        {isActive && (
          <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Status icon */}
      <div className="shrink-0">
        {isActive && <Loader2 className="size-3.5 animate-spin text-primary" />}
        {isProcessing && <Loader2 className="size-3.5 animate-spin text-warning" />}
        {isDone && <Check className="size-3.5 text-success" />}
        {isFailed && <AlertCircle className="size-3.5 text-destructive" />}
      </div>
    </div>
  );
}

export function UploadToast() {
  const { uploads, dismissUploads } = useUploadContext();

  if (uploads.length === 0) return null;

  const activeCount = uploads.filter((u) => u.status === "uploading" || u.status === "processing").length;

  return (
    <div className="fixed top-4 right-4 z-[100] w-72 rounded-xl border border-border bg-card shadow-lg animate-in slide-in-from-top-2 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">
          {activeCount > 0
            ? `Enviando ${activeCount} arquivo${activeCount > 1 ? "s" : ""}…`
            : "Upload concluído"}
        </span>
        <button
          onClick={dismissUploads}
          className="rounded p-0.5 hover:bg-muted transition-colors"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Items */}
      <div className="max-h-48 overflow-y-auto divide-y divide-border">
        {uploads.map((item) => (
          <UploadItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
