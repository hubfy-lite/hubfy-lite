import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PortalProductsTemplate = "gallery_01";

export interface DesignPortalFormData {
  portal_products_template: PortalProductsTemplate;
}

interface DesignPortalTabProps {
  formData: DesignPortalFormData;
  tenantSlug: string;
  onChange: (data: Partial<DesignPortalFormData>) => void;
}

export default function DesignPortalTab({
  formData,
  tenantSlug,
  onChange,
}: DesignPortalTabProps) {
  const { t } = useTranslation();
  const portalHref = tenantSlug ? `/${tenantSlug}` : "#";

  return (
    <div className="space-y-6">
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t("designPage.portal.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("designPage.portal.quickLinkLabel")}
              </Label>
            </div>
            {tenantSlug ? (
              <Button asChild variant="outline" size="sm">
                <a href={portalHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {t("designPage.portal.quickLinkLabel")}
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ExternalLink className="size-4" />
                {t("designPage.portal.quickLinkLabel")}
              </Button>
            )}
          </div>

          <div className="border-t border-border" />

          <div className="space-y-2">
            <div>
              <Label>{t("designPage.portal.templateLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("designPage.portal.templateDescription")}
              </p>
            </div>
            <Select
              value={formData.portal_products_template}
              onValueChange={(value: PortalProductsTemplate) =>
                onChange({ portal_products_template: value })
              }
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gallery_01">
                  {t("designPage.portal.templateOptionCarousel")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("designPage.portal.templateComingSoon")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
