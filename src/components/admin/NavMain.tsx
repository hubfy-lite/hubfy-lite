import {
  House,
  BookOpen,
  Users,
  FolderOpen,
  Settings,
  ShoppingBag,
  Receipt,
  Palette,
  Plug,
  Shield,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  to: string;
  icon: React.ComponentType;
  labelKey: string;
  end?: boolean;
  tourId?: string;
}

const mainItems: NavItem[] = [
  { to: "/admin", icon: House, labelKey: "nav.home", end: true },
  { to: "/admin/orders", icon: Receipt, labelKey: "nav.orders" },
  { to: "/admin/customers", icon: Users, labelKey: "nav.customers", tourId: "nav-customers" },
  { to: "/admin/products", icon: ShoppingBag, labelKey: "nav.products", tourId: "nav-products" },
];

const workspaceItems: NavItem[] = [
  { to: "/admin/assets", icon: FolderOpen, labelKey: "nav.myFiles" },
  { to: "/admin/courses", icon: BookOpen, labelKey: "nav.courses" },
  { to: "/admin/integrations", icon: Plug, labelKey: "nav.integrations", tourId: "nav-integrations" },
  { to: "/admin/settings", icon: Settings, labelKey: "nav.settings" },
];

export function NavMain() {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const label = t(item.labelKey);
      return (
        <SidebarMenuItem key={item.labelKey} data-tour={item.tourId}>
          <SidebarMenuButton
            asChild
            isActive={isActive(item.to, item.end)}
            tooltip={label}
          >
            <NavLink to={item.to} end={item.end} onClick={closeMobile}>
              <item.icon />
              <span>{label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <>
      <SidebarGroup>
        <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
<SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/admin/design")}
              tooltip={t("nav.design")}
            >
              <NavLink to="/admin/design" onClick={closeMobile}>
                <Palette />
                <span>{t("nav.design")}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>{t("workspace.label")}</SidebarGroupLabel>
        <SidebarMenu>{renderItems(workspaceItems)}</SidebarMenu>
      </SidebarGroup>

      {isAdmin && (
        <SidebarGroup>
          <SidebarGroupLabel>Hubfy</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Superadmin">
                <NavLink to="/superadmin/dashboard" onClick={closeMobile}>
                  <Shield />
                  <span>Superadmin</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  );
}
