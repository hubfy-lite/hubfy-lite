import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductAsset {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  signedUrl?: string;
}

export interface ProductShowcase {
  id: string;
  name: string;
  slug: string;
}

export interface ProductLink {
  id: string;
  url: string;
  title: string;
  description: string | null;
}

interface ProductAccessData {
  benefit: string | null;
  assets: ProductAsset[];
  links: ProductLink[];
  showcase: ProductShowcase | null;
}

interface LinkedAssetFile {
  bucket: string | null;
  object_path: string;
  original_filename: string;
}

interface LinkedAsset {
  id: string;
  title: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  asset_files: LinkedAssetFile[] | LinkedAssetFile | null;
}

interface LinkedProductAssetRow {
  asset_id: string;
  sort_order: number;
  assets: LinkedAsset | null;
}

export function useProductAccess(productId: string | undefined) {
  return useQuery({
    queryKey: ["portal-product-access", productId],
    enabled: !!productId,
    staleTime: 30_000,
    queryFn: async (): Promise<ProductAccessData> => {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("benefit")
        .eq("id", productId!)
        .single();
      if (productError) throw productError;

      let assets: ProductAsset[] = [];
      let links: ProductLink[] = [];
      let showcase: ProductShowcase | null = null;

      if (product.benefit === "files") {
        const { data: linkedAssets, error: linkedAssetsError } = await supabase
          .from("product_assets")
          .select(
            "asset_id, sort_order, assets!inner(id, title, mime_type, size_bytes, status, asset_files(bucket, object_path, original_filename))"
          )
          .eq("product_id", productId!)
          .order("sort_order", { ascending: true });
        if (linkedAssetsError) throw linkedAssetsError;

        const resolvedAssets = await Promise.all(
          ((linkedAssets ?? []) as LinkedProductAssetRow[]).map(async (item) => {
            const asset = item.assets;
            const assetFile = Array.isArray(asset?.asset_files)
              ? asset.asset_files[0]
              : asset?.asset_files;

            if (!asset || asset.status !== "ready" || !assetFile?.object_path) {
              return null;
            }

            const { data: signedData } = await supabase.storage
              .from(assetFile.bucket || "assets")
              .createSignedUrl(assetFile.object_path, 3600, {
                download: assetFile.original_filename || true,
              });

            return {
              id: asset.id,
              file_name: assetFile.original_filename || asset.title || "Arquivo",
              file_size: asset.size_bytes ?? null,
              mime_type: asset.mime_type ?? null,
              signedUrl: signedData?.signedUrl ?? undefined,
            } as ProductAsset;
          })
        );

        assets = resolvedAssets.filter(Boolean) as ProductAsset[];
      }

      if (product.benefit === "links") {
        const { data: productLinks, error: linksError } = await supabase
          .from("product_links")
          .select("id, url, title, description")
          .eq("product_id", productId!)
          .order("sort_order", { ascending: true });
        if (linksError) throw linksError;

        links = (productLinks ?? []).map((l) => ({
          id: l.id,
          url: l.url,
          title: l.title,
          description: l.description,
        }));
      }

      // Find showcase via product → courses → showcase_courses → showcases
      const { data: courseLinks, error: courseLinksError } = await supabase
        .from("product_courses")
        .select("courses(showcase_courses(showcases(id, title, slug)))")
        .eq("product_id", productId!);
      if (courseLinksError) throw courseLinksError;

      // Extract first showcase found from the nested joins
      for (const link of courseLinks ?? []) {
        const course = link.courses as { showcase_courses?: { showcases?: { id: string; title: string; slug: string } | null }[] } | null;
        const sc = course?.showcase_courses?.[0]?.showcases;
        if (sc) {
          showcase = { id: sc.id, name: sc.title, slug: sc.slug };
          break;
        }
      }

      return {
        benefit: product.benefit,
        assets,
        links,
        showcase,
      };
    },
  });
}
