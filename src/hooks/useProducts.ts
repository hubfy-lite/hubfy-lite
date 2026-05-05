import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { limitNameLength } from "@/lib/name-limits";
import { invalidatePortalProducts } from "@/lib/query-invalidation";
import { cleanCoverValue } from "@/lib/storage-urls";
import type { Database } from "@/integrations/supabase/types";

type ProductStatus = Database["public"]["Enums"]["product_status"];

export type BenefitType = "files" | "courses" | "links";

export interface LinkItem {
  url: string;
  title: string;
  description?: string;
}

export interface Product {
  id: string;
  public_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  status: ProductStatus;
  unit_amount: number;
  currency: string;
  test_mode: boolean;
  benefit: BenefitType | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // joined counts
  courses_count: number;
  assets_count: number;
  links_count: number;
  prices_count: number;
  orders_count: number;
}

export interface CreateProductData {
  name: string;
  description?: string;
  cover_url?: string;
  benefit: BenefitType | null;
  /** IDs of assets to link (when benefit = 'files', max 10) */
  asset_ids?: string[];
  /** IDs of courses to link (when benefit = 'courses') */
  course_ids?: string[];
  /** Link items to create inline (when benefit = 'links', max 20) */
  link_items?: LinkItem[];
}

export interface UpdateProductData {
  name?: string;
  description?: string | null;
  cover_url?: string | null;
  status?: ProductStatus;
  test_mode?: boolean;
}

export interface SetProductDeliverableData {
  benefit: BenefitType;
  asset_ids?: string[];
  course_ids?: string[];
  link_items?: LinkItem[];
}

interface ProductRow {
  id: string;
  public_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  unit_amount: number | null;
  currency: string | null;
  status: ProductStatus;
  test_mode: boolean | null;
  benefit: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product_courses: { id: string; course_id: string }[] | null;
  product_assets: { id: string }[] | null;
  product_links: { id: string }[] | null;
  prices: { id: string }[] | null;
  orders: { count: number }[] | null;
}

export function useProducts(searchQuery = "", statusFilter: ProductStatus[] = []) {
  const { tenant, loading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  const tenantId = tenant?.id ?? null;
  const queryKey = ["products", tenantId, searchQuery, statusFilter];

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    if (!tenantId) return [];

    let query = supabase
      .from("products")
      .select(
        "*, product_courses(id, course_id), product_assets(id), product_links(id), prices(id), orders(count)"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data ?? []).map((p: ProductRow) => ({
      id: p.id,
      public_id: p.public_id,
      tenant_id: p.tenant_id,
      name: limitNameLength(p.name),
      description: p.description,
      cover_url: p.cover_url,
      unit_amount: p.unit_amount ?? 0,
      currency: p.currency ?? "BRL",
      status: p.status,
      test_mode: p.test_mode ?? false,
      benefit: p.benefit as BenefitType | null,
      sort_order: p.sort_order,
      created_at: p.created_at,
      updated_at: p.updated_at,
      courses_count: p.product_courses?.length ?? 0,
      assets_count: p.product_assets?.length ?? 0,
      links_count: p.product_links?.length ?? 0,
      prices_count: p.prices?.length ?? 0,
      orders_count: p.orders?.[0]?.count ?? 0,
    }));
  }, [tenantId, statusFilter]);

  const hasLoadedOnce = useRef(false);

  const {
    data: allProducts = [],
    isPending: queryPending,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchProducts,
    enabled: !!tenantId,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  if (!queryPending && allProducts.length >= 0) {
    hasLoadedOnce.current = true;
  }

  // Client-side search (name is already indexed server-side via trigram)
  const products = searchQuery
    ? allProducts.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allProducts;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["products", tenantId] });
    invalidatePortalProducts(queryClient);
  };

  const createProduct = async (data: CreateProductData) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
      // New product goes to end: max sort_order + 1
      const nextSortOrder = (allProducts.length > 0
        ? Math.max(...allProducts.map((p) => p.sort_order)) + 1
        : 1);

      const { data: result, error } = await supabase
        .from("products")
        .insert({
          tenant_id: tenantId,
          name: limitNameLength(data.name.trim()),
          description: data.description,
          cover_url: cleanCoverValue(data.cover_url) || null,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-create a free price for the product
      await supabase.from("prices").insert({
        product_id: result.id,
        category: "one_time",
        unit_amount: 0,
        currency: "BRL",
      });

      // Set deliverable via RPC (atomic: sets benefit + links in one transaction)
      if (data.benefit) {
        await supabase.rpc("set_product_deliverable", {
          p_product_id: result.id,
          p_benefit: data.benefit,
          p_asset_ids: data.benefit === "files" ? data.asset_ids ?? [] : [],
          p_course_ids: data.benefit === "courses" ? data.course_ids ?? [] : [],
          p_link_items: data.benefit === "links"
            ? (data.link_items ?? []) as unknown as string[]
            : [],
        });
      }

      invalidate();
      return result;
    } finally {
      setActionLoading(false);
    }
  };

  const updateProduct = async (productId: string, data: UpdateProductData) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
      const nextUpdatedAt = new Date().toISOString();
      const payload: UpdateProductData = {
        ...data,
        ...(data.cover_url !== undefined
          ? { cover_url: cleanCoverValue(data.cover_url) || null }
          : {}),
        ...(typeof data.name === "string"
          ? { name: limitNameLength(data.name.trim()) }
          : {}),
      };

      // Atualização otimista — tabela admin reflete a mudança instantaneamente
      queryClient.setQueriesData<Product[]>(
        { queryKey: ["products", tenantId] },
        (old) =>
          old?.map((p) =>
            p.id === productId ? { ...p, ...payload, updated_at: nextUpdatedAt } : p
          )
      );

      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
      invalidate();
    } finally {
      setActionLoading(false);
    }
  };

  const setProductDeliverable = async (
    productId: string,
    data: SetProductDeliverableData
  ) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("set_product_deliverable", {
        p_product_id: productId,
        p_benefit: data.benefit,
        p_asset_ids: data.benefit === "files" ? data.asset_ids ?? [] : [],
        p_course_ids: data.benefit === "courses" ? data.course_ids ?? [] : [],
        p_link_items: data.benefit === "links" ? (data.link_items ?? []) as unknown as string[] : [],
      });

      if (error) throw error;
      invalidate();
    } finally {
      setActionLoading(false);
    }
  };

  const reorderProducts = async (orderedIds: string[]) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
      // Optimistic update
      queryClient.setQueriesData<Product[]>(
        { queryKey: ["products", tenantId] },
        (old) => {
          if (!old) return old;
          const byId = new Map(old.map((p) => [p.id, p]));
          return orderedIds
            .map((id, i) => {
              const p = byId.get(id);
              return p ? { ...p, sort_order: i + 1 } : null;
            })
            .filter(Boolean) as Product[];
        }
      );

      // Persist to database
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase
            .from("products")
            .update({ sort_order: i + 1 })
            .eq("id", id)
            .eq("tenant_id", tenantId)
        )
      );

      invalidate();
    } finally {
      setActionLoading(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
      invalidate();
    } finally {
      setActionLoading(false);
    }
  };

  // Skeleton only on first load; subsequent navigations keep previous data visible
  const loading = tenantLoading || (!!tenantId && queryPending && !hasLoadedOnce.current);

  return {
    products,
    loading,
    actionLoading,
    error: error as Error | null,
    refetch,
    createProduct,
    updateProduct,
    setProductDeliverable,
    reorderProducts,
    deleteProduct,
  };
}
