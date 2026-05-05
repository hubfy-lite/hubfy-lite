import { useTranslation } from "react-i18next";

interface BrowserChromeProps {
  url?: string;
  children: React.ReactNode;
}

export default function BrowserChrome({
  url,
  children,
}: BrowserChromeProps) {
  const { t } = useTranslation();
  const displayUrl = url ?? t("browserChrome.defaultUrl");
  return (
    <div className="flex flex-col h-full rounded-xl border border-border overflow-hidden shadow-lg">
      {/* Browser toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border shrink-0">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-full bg-red-400" />
          <div className="size-3 rounded-full bg-yellow-400" />
          <div className="size-3 rounded-full bg-green-400" />
        </div>
        {/* URL bar */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-sm bg-background rounded-md border border-border px-3 py-1 text-xs text-muted-foreground text-center truncate">
            {displayUrl}
          </div>
        </div>
        <div className="w-[54px]" />
      </div>
      {/* Browser content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
