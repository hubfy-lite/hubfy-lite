import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export interface ChecklistItem {
  key: string;
  titleKey: string;
  descKey: string;
  href: string;
  completed: boolean;
}

export interface ChecklistResult {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  isLoading: boolean;
  isComplete: boolean;
}

async function hasRow(table: string, tenantId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase.from(table as any) as any)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .limit(1);
  if (error) return false;
  return (count ?? 0) > 0;
}

export function useOnboardingChecklist(): ChecklistResult {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-checklist", tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!tenantId) {
        return { product: false, course: false, customer: false };
      }
      const [product, course, customer] = await Promise.all([
        hasRow("products", tenantId),
        hasRow("courses", tenantId),
        hasRow("customers", tenantId),
      ]);
      return { product, course, customer };
    },
  });

  const items: ChecklistItem[] = [
    {
      key: "product",
      titleKey: "onboarding.checklist.product.title",
      descKey: "onboarding.checklist.product.desc",
      href: "/admin/products",
      completed: data?.product ?? false,
    },
    {
      key: "course",
      titleKey: "onboarding.checklist.course.title",
      descKey: "onboarding.checklist.course.desc",
      href: "/admin/courses",
      completed: data?.course ?? false,
    },
    {
      key: "customer",
      titleKey: "onboarding.checklist.customer.title",
      descKey: "onboarding.checklist.customer.desc",
      href: "/admin/customers",
      completed: data?.customer ?? false,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;

  return {
    items,
    completedCount,
    totalCount,
    isLoading,
    isComplete: !isLoading && completedCount === totalCount,
  };
}
