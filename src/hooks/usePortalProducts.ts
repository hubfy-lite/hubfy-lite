import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PortalAccessRole } from "@/contexts/PortalContext";

export type PortalProductBenefit = "files" | "courses" | null;

export interface PortalProductShowcase {
  id: string;
  slug: string;
  title: string;
}

export interface PortalProduct {
  id: string;
  public_id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  updatedAt: string;
  benefit: PortalProductBenefit;
  showcase: PortalProductShowcase | null;
  courseSlug: string | null;
  hasAccess: boolean;
}

interface UsePortalProductsParams {
  tenantId: string | undefined;
  accessRole: PortalAccessRole | null;
}

interface RawShowcase {
  id: string;
  slug: string;
  title: string;
}

interface RawShowcaseCourseJoin {
  showcases: RawShowcase | null;
}

interface RawCourse {
  slug: string;
  showcase_courses?: RawShowcaseCourseJoin[] | null;
}

interface RawProductCourseRelation {
  courses: RawCourse | null;
}

interface RawProduct {
  id: string;
  public_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  updated_at: string;
  benefit: string | null;
  product_courses?: RawProductCourseRelation[] | null;
}

function extractShowcase(product: RawProduct): PortalProductShowcase | null {
  // Navigate: product_courses → courses → showcase_courses → showcases
  for (const pc of product.product_courses ?? []) {
    const sc = pc.courses?.showcase_courses?.[0]?.showcases;
    if (sc) {
      return { id: sc.id, slug: sc.slug, title: sc.title };
    }
  }
  return null;
}

function extractCourseSlug(product: RawProduct): string | null {
  for (const pc of product.product_courses ?? []) {
    if (pc.courses?.slug) return pc.courses.slug;
  }
  return null;
}

function mapProduct(product: RawProduct): PortalProduct {
  return {
    id: product.id,
    public_id: product.public_id,
    name: product.name,
    description: product.description ?? null,
    coverUrl: product.cover_url ?? null,
    updatedAt: product.updated_at,
    benefit: (product.benefit as PortalProductBenefit) ?? null,
    showcase: extractShowcase(product),
    courseSlug: extractCourseSlug(product),
    hasAccess: true,
  };
}

export function usePortalProducts({ tenantId, accessRole }: UsePortalProductsParams) {
  return useQuery({
    queryKey: ["portal-products-hero", tenantId, accessRole],
    enabled: !!tenantId && !!accessRole,
    staleTime: 30_000,
    queryFn: async (): Promise<PortalProduct[]> => {
      if (!tenantId || !accessRole) return [];

      if (accessRole === "tenant_user") {
        const { data, error } = await supabase
          .from("products")
          .select("id, public_id, name, description, cover_url, updated_at, benefit, product_courses(courses(slug, showcase_courses(showcases(id, slug, title))))")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .order("sort_order", { ascending: true });

        if (error) throw error;
        return ((data ?? []) as RawProduct[]).map(mapProduct);
      }

      const { data: purchased, error: purchasedError } = await supabase.rpc(
        "get_customer_purchased_products"
      );
      if (purchasedError) throw purchasedError;

      const purchasedProductIds = new Set(
        (purchased ?? []).map((item) => item.product_id)
      );

      const { data: allProducts, error: allProductsError } = await supabase
        .from("products")
        .select("id, public_id, name, description, cover_url, updated_at, benefit, product_courses(courses(slug, showcase_courses(showcases(id, slug, title))))")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      if (allProductsError) throw allProductsError;

      return ((allProducts ?? []) as RawProduct[]).map((product) => ({
        ...mapProduct(product),
        hasAccess: purchasedProductIds.has(product.id),
      }));
    },
  });
}
