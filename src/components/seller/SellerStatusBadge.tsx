import { useTranslation } from "react-i18next";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { SellerStatus } from "@/types/seller";

const statusConfig: Record<SellerStatus, { variant: BadgeVariant; className?: string }> = {
  draft: { variant: "gray" },
  pending: { variant: "yellow" },
  approved: { variant: "green" },
  rejected: { variant: "red" },
  disabled: { variant: "gray", className: "opacity-60" },
  deleted: { variant: "gray", className: "opacity-40 line-through" },
};

interface SellerStatusBadgeProps {
  status: SellerStatus;
}

export function SellerStatusBadge({ status }: SellerStatusBadgeProps) {
  const { t } = useTranslation();

  const config = statusConfig[status] ?? statusConfig.draft;

  return (
    <Badge variant={config.variant} className={config.className}>
      {t(`seller.status.${status}`)}
    </Badge>
  );
}
