import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShoppingBag } from "lucide-react";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";
import PortalLayout from "@/components/portal/PortalLayout";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PORTAL_PRODUCT_FALLBACK = "/images/placeholders/product-portal-fallback.svg";

export default function PortalProducts() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: products, isLoading } = useCustomerProducts();

  return (
    <PortalLayout>
      <div className="space-y-6 px-4 pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("portal.products.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("portal.products.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !products?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <ShoppingBag className="size-10 text-muted-foreground" />
            <p className="text-muted-foreground">{t("portal.products.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card
                key={product.product_id}
                className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                onClick={() =>
                  navigate(`/${slug}/portal/products/${product.product_id}`)
                }
              >
                {/* Capa do produto */}
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  <img
                    src={
                      product.product_cover_url
                        ? getCoversOptimizedUrl(
                            product.product_cover_url,
                            "product-card",
                            product.product_updated_at
                          ) || PORTAL_PRODUCT_FALLBACK
                        : PORTAL_PRODUCT_FALLBACK
                    }
                    alt={product.product_name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground line-clamp-2">
                    {product.product_name}
                  </h3>
                  {product.product_benefit && (
                    <Badge variant="secondary" className="capitalize">
                      {product.product_benefit === "files"
                        ? t("portal.products.benefitFiles")
                        : t("portal.products.benefitShowcase")}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
