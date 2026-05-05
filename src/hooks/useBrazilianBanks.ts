import { useQuery } from "@tanstack/react-query";

export interface BrazilianBank {
  ispb: string;
  name: string;
  code: number | null;
  fullName: string;
}

const CACHE_KEY = "hubfy.brazilian_banks";
const CACHE_TTL = 365 * 24 * 60 * 60 * 1000; // 12 months in ms

function getCachedBanks(): BrazilianBank[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data as BrazilianBank[];
  } catch {
    return null;
  }
}

function setCachedBanks(banks: BrazilianBank[]) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: banks, timestamp: Date.now() })
    );
  } catch {
    // localStorage full — ignore
  }
}

async function fetchBanksWithRetry(retries = 2): Promise<BrazilianBank[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://brasilapi.com.br/api/banks/v1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BrazilianBank[] = await res.json();

      // Filter out banks without code (less useful) and sort by code
      const filtered = data
        .filter((b) => b.code !== null)
        .sort((a, b) => (a.code ?? 0) - (b.code ?? 0));

      setCachedBanks(filtered);
      return filtered;
    } catch (err) {
      if (attempt === retries) throw err;
      // Wait 1s before retry
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Failed to fetch banks");
}

/**
 * Fetches the list of Brazilian banks from BrasilAPI.
 * - Caches in localStorage for 12 months
 * - Retries up to 2x on failure
 * - Only enabled when `enabled` is true (lazy fetch)
 */
export function useBrazilianBanks(enabled = true) {
  return useQuery<BrazilianBank[]>({
    queryKey: ["brazilian-banks"],
    queryFn: async () => {
      // Try cache first
      const cached = getCachedBanks();
      if (cached) return cached;
      return fetchBanksWithRetry();
    },
    enabled,
    staleTime: CACHE_TTL,
    gcTime: CACHE_TTL,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
