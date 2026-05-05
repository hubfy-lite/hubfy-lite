import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

/** Maps each route to its breadcrumb translation key. */
const PATH_TO_KEY: Record<string, string> = {
  "/admin": "breadcrumb.home",
  "/admin/courses": "breadcrumb.courses",
  "/admin/courses/new": "breadcrumb.newCourse",
  "/admin/customers": "breadcrumb.customers",
  "/admin/products": "breadcrumb.products",
  "/admin/orders": "breadcrumb.orders",
  "/admin/settings": "breadcrumb.settings",
  "/admin/profile": "breadcrumb.profile",
  "/admin/assets": "breadcrumb.assets",
  "/admin/showcases": "breadcrumb.showcase",
  "/admin/new-workspace": "breadcrumb.newWorkspace",
  "/admin/design": "breadcrumb.design",
  "/admin/integrations": "breadcrumb.integrations",
};

/**
 * Resolve a chave de tradução com base no pathname.
 * Para rotas dinâmicas (ex: /admin/courses/:id), encontra o pai mais longo.
 */
function resolveKey(pathname: string): string {
  // Match exato
  if (PATH_TO_KEY[pathname]) return PATH_TO_KEY[pathname];

  // Rotas dinâmicas: encontrar o prefixo mais longo que tenha chave
  const candidates = Object.entries(PATH_TO_KEY)
    .filter(([path]) => path !== "/admin" && pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length);

  if (candidates.length > 0) return candidates[0][1];

  // Fallback
  return "breadcrumb.home";
}

export function PageBreadcrumb() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const title = t(resolveKey(pathname));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
