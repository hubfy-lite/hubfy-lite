import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileBox, Users, Package, GraduationCap, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useTranslation } from "react-i18next";

export const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  course: BookOpen,
  lesson: GraduationCap,
  product: Package,
  asset: FileBox,
  customer: Users,
  order: Receipt,
};

export const CATEGORY_ORDER = [
  "course",
  "lesson",
  "product",
  "asset",
  "customer",
  "order",
] as const;

export interface SearchResult {
  category: "course" | "lesson" | "product" | "asset" | "customer" | "order";
  id: string;
  title: string;
  subtitle: string | null; // translatable status code (active, draft, completed...)
  meta: string | null;     // literal text (email, course name, amount)
  url: string;
}

const DEBOUNCE_MS = 300;
const MAX_RECENT = 5;

function getStorageKey(tenantId: string) {
  return `hubfy.search.recent.${tenantId}`;
}

function loadRecentQueries(tenantId: string | undefined): string[] {
  if (!tenantId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(tenantId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentQuery(tenantId: string | undefined, query: string) {
  if (!tenantId || query.trim().length < 2) return;
  const key = getStorageKey(tenantId);
  const existing = loadRecentQueries(tenantId);
  const trimmed = query.trim();
  const deduped = [trimmed, ...existing.filter((q) => q !== trimmed)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(key, JSON.stringify(deduped));
  } catch {
    // localStorage full — ignore
  }
}

export function useGlobalSearch() {
  const { tenant } = useTenant();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [recentVersion, setRecentVersion] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Debounced value
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), []);

  const updateQuery = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, DEBOUNCE_MS);
  };

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["global-search", tenant?.id, debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!tenant?.id || !debouncedQuery) return [];

      const { data, error } = await supabase.rpc("global_search", {
        p_tenant_id: tenant.id,
        p_query: debouncedQuery,
      });

      if (error) {
        // Log para debugging
        console.error("[global_search] RPC error:", error.message, error);
        
        // Determinar mensagem de erro apropriada
        const errorMessage = error.message === "Not authorized"
          ? t("search.error.not_authorized", "You don't have permission to search")
          : error.message || t("common.error", "An error occurred");
        
        // Exibir toast ao usuário
        if (errorMessage !== lastError) {
          toast.error(errorMessage, {
            duration: 3000,
            id: "global-search-error",
          });
          setLastError(errorMessage);
        }
        
        throw error;
      }
      
      // Limpar estado de erro se a busca foi bem-sucedida
      if (lastError) {
        setLastError(null);
      }
      
      return (data ?? []) as SearchResult[];
    },
    enabled: !!tenant?.id && debouncedQuery.length >= 2,
    staleTime: 15_000,
    retry: false, // Não faz retry em erro de autorização
  });

  // Group results by category
  const grouped = useMemo(() => {
    const map: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!map[r.category]) map[r.category] = [];
      map[r.category].push(r);
    }
    return map;
  }, [results]);

  // Recent queries (re-read on recentVersion change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recentQueries = useMemo(() => loadRecentQueries(tenant?.id), [tenant?.id, recentVersion]);

  const saveRecent = useCallback(() => {
    if (query.trim().length >= 2) {
      saveRecentQuery(tenant?.id, query);
      setRecentVersion((v) => v + 1);
    }
  }, [tenant?.id, query]);

  const reset = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setLastError(null);
  }, []);

  return {
    query,
    setQuery: updateQuery,
    results,
    grouped,
    isLoading: isLoading && debouncedQuery.length >= 2,
    reset,
    recentQueries,
    saveRecent,
  };
}
