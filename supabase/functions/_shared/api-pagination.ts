// Parses ?page and ?per_page query params, clamps to safe ranges,
// and builds pagination meta objects for list responses.

export interface PaginationParams {
  page: number;      // 1-based
  perPage: number;   // max 100
  offset: number;    // 0-based offset for DB queries
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

export function parsePagination(url: URL): PaginationParams {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const rawPerPage = Number.parseInt(
    url.searchParams.get("per_page") ?? String(DEFAULT_PER_PAGE),
    10,
  );
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number.isFinite(rawPerPage) ? rawPerPage : DEFAULT_PER_PAGE),
  );
  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
  };
}

export function buildMeta(
  params: PaginationParams,
  total: number,
): PaginationMeta {
  return {
    page: params.page,
    per_page: params.perPage,
    total,
    has_more: params.offset + params.perPage < total,
  };
}

export interface SortParam {
  column: string;
  ascending: boolean;
}

/**
 * Parses a ?sort=field or ?sort=-field query string.
 * Returns default when param is missing, unknown, or disallowed.
 */
export function parseSort(
  url: URL,
  allowed: readonly string[],
  defaultColumn: string,
  defaultAscending = false,
): SortParam {
  const raw = url.searchParams.get("sort");
  if (!raw) return { column: defaultColumn, ascending: defaultAscending };
  const ascending = !raw.startsWith("-");
  const column = raw.replace(/^-/, "");
  if (!allowed.includes(column)) {
    return { column: defaultColumn, ascending: defaultAscending };
  }
  return { column, ascending };
}
