import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { useTranslation } from "react-i18next";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SearchResults } from "@/components/admin/SearchResults";
import { Command } from "@/components/ui/command";

export function CommandSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { query, setQuery, grouped, isLoading, reset, recentQueries, saveRecent } = useGlobalSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const showDropdown = open && (query.length >= 2 || (query.length === 0 && recentQueries.length > 0));

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
          setOpen(false);
        } else {
          inputRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = useCallback(
    (url: string) => {
      saveRecent();
      setOpen(false);
      reset();
      inputRef.current?.blur();
      navigate(url);
    },
    [navigate, reset, saveRecent],
  );

  const handleRecentClick = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery);
    },
    [setQuery],
  );

  return (
    <div ref={containerRef} className="relative flex-1 flex justify-center">
      <Command
        shouldFilter={false}
        className="relative w-[448px] max-w-full overflow-visible bg-transparent"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <CommandPrimitive.Input
            ref={inputRef}
            placeholder={t("search.placeholder")}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            className="flex h-9 w-full rounded-lg border border-input bg-background pl-9 pr-16 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border bg-popover shadow-lg overflow-hidden">
            <SearchResults
              query={query}
              grouped={grouped}
              isLoading={isLoading}
              onSelect={handleSelect}
              recentQueries={recentQueries}
              onRecentClick={handleRecentClick}
              className="max-h-[min(400px,60vh)]"
            />
          </div>
        )}
      </Command>
    </div>
  );
}
