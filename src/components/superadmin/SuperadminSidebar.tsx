import {
  LayoutDashboard,
  Building2,
  Receipt,
  Users,
  ShoppingBag,
  Store,
  UserCog,
  ArrowLeft,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/admin/NavUser";
import { useTheme } from "@/contexts/ThemeContext";
import { BRAND_AVATAR_DARK, BRAND_AVATAR_LIGHT } from "@/lib/brand";

const navItems = [
  { to: "/superadmin/dashboard", icon: LayoutDashboard, labelKey: "superadmin.nav.dashboard", end: true },
  { to: "/superadmin/tenants", icon: Building2, labelKey: "superadmin.nav.tenants" },
  { to: "/superadmin/users", icon: UserCog, labelKey: "superadmin.nav.users" },
  { to: "/superadmin/orders", icon: Receipt, labelKey: "superadmin.nav.orders" },
  { to: "/superadmin/customers", icon: Users, labelKey: "superadmin.nav.customers" },
  { to: "/superadmin/products", icon: ShoppingBag, labelKey: "superadmin.nav.products" },
  { to: "/superadmin/sellers", icon: Store, labelKey: "superadmin.nav.sellers" },
];

export function SuperadminSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const avatarSrc = theme === "dark"
    ? BRAND_AVATAR_LIGHT
    : BRAND_AVATAR_DARK;

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              asChild
            >
              <NavLink to="/superadmin/dashboard">
                <img
                  src={avatarSrc}
                  alt="Hubfy"
                  className="size-8 rounded-lg shrink-0"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-sidebar-foreground">
                    Hubfy
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("superadmin.title")}
                  </span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.to, item.end)}
                  tooltip={t(item.labelKey)}
                >
                  <NavLink to={item.to} end={item.end}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Hubfy</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t("superadmin.nav.backToConsole")}>
                <NavLink to="/admin">
                  <ArrowLeft />
                  <span>{t("superadmin.nav.backToConsole")}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
