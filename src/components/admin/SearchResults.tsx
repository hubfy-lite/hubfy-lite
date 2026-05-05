import { Search, Loader2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import type { SearchResult } from "@/hooks/useGlobalSearch";
import { CATEGORY_ICONS, CATEGORY_ORDER } from "@/hooks/useGlobalSearch";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ── Helpers ──

/** Format order meta "unit_amount|currency" into localized string */
function formatOrderMeta(meta: string): string {
  const [amountStr, currency] = meta.split("|");
  const cents = parseInt(amountStr, 10);
  if (isNaN(cents) || !currency) return meta;

  const locale =
    currency === "BRL" ? "pt-BR" : currency === "EUR" ? "es" : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function resolveMetaDisplay(item: SearchResult): string | null {
  if (!item.meta) return null;
  if (item.category === "order") return formatOrderMeta(item.meta);
  return item.meta;
}

// ── Highlight ──

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <span className="font-semibold text-foreground">{match}</span>
      {after}
    </>
  );
}

// ── Row ──

interface SearchResultRowProps {
  item: SearchResult;
  icon: LucideIcon;
  query: string;
}

function SearchResultRow({ item, icon: Icon, query }: SearchResultRowProps) {
  const { t } = useTranslation();

  const subtitleText = item.subtitle
    ? t(`search.subtitles.${item.subtitle}`, item.subtitle)
    : null;
  const metaText = resolveMetaDisplay(item);

  return (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground mr-2" />
      <div className="flex flex-col min-w-0">
        <span className="truncate text-sm">
          {highlightMatch(item.title, query)}
        </span>
        {(subtitleText || metaText) && (
          <span className="truncate text-xs text-muted-foreground">
            {subtitleText}
            {subtitleText && metaText && " · "}
            {metaText && highlightMatch(metaText, query)}
          </span>
        )}
      </div>
    </>
  );
}

// ── Main ──

interface SearchResultsProps {
  query: string;
  grouped: Record<string, SearchResult[]>;
  isLoading: boolean;
  onSelect: (url: string) => void;
  recentQueries?: string[];
  onRecentClick?: (query: string) => void;
  className?: string;
  showHint?: boolean;
}

export function SearchResults({
  query,
  grouped,
  isLoading,
  onSelect,
  recentQueries = [],
  onRecentClick,
  className,
  showHint = false,
}: SearchResultsProps) {
  const { t } = useTranslation();
  const hasResults = Object.keys(grouped).length > 0;
  const showRecent = query.length < 2 && recentQueries.length > 0;

  return (
    <CommandList className={className}>
      {/* Recent queries */}
      {showRecent && (
        <CommandGroup heading={t("search.recent")}>
          {recentQueries.map((q) => (
            <CommandItem
              key={`recent-${q}`}
              value={`recent-${q}`}
              onSelect={() => onRecentClick?.(q)}
            >
              <Clock className="size-4 shrink-0 text-muted-foreground mr-2" />
              <span className="truncate text-sm">{q}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {/* Hint (mobile: before typing, only if no recents) */}
      {showHint && query.length < 2 && !isLoading && !showRecent && (
        <div className="py-12 text-center">
          <Search className="size-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("search.mobileHint")}
          </p>
        </div>
      )}

      {/* Loading */}
      {query.length >= 2 && isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No results */}
      {query.length >= 2 && !isLoading && !hasResults && (
        <CommandEmpty>{t("search.noResults")}</CommandEmpty>
      )}

      {/* Grouped results */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items?.length) return null;
        const Icon = CATEGORY_ICONS[cat];
        return (
          <CommandGroup key={cat} heading={t(`search.categories.${cat}`)}>
            {items.map((item) => (
              <CommandItem
                key={`${cat}-${item.id}`}
                value={`${cat}-${item.id}-${item.title}`}
                onSelect={() => onSelect(item.url)}
              >
                <SearchResultRow item={item} icon={Icon} query={query} />
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
    </CommandList>
  );
}
