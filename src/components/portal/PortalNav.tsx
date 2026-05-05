import {
  House,
  User,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavItem {
  toSuffix: string;
  icon: React.ComponentType;
  labelKey: string;
  end?: boolean;
}

const navItems: NavItem[] = [
  { toSuffix: "", icon: House, labelKey: "portal.nav.home", end: true },
  { toSuffix: "/profile", icon: User, labelKey: "portal.nav.profile" },
  { toSuffix: "/orders", icon: Receipt, labelKey: "portal.nav.orders" },
  { toSuffix: "/products", icon: ShoppingBag, labelKey: "portal.nav.products" },
];

export function PortalNav() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const basePath = `/${slug}/portal`;

  const isActive = (suffix: string, end?: boolean) => {
    const fullPath = basePath + suffix;
    if (end) return location.pathname === fullPath;
    return location.pathname.startsWith(fullPath);
  };

  return (
    <SidebarGroup>
      <SidebarMenu>
        {navItems.map((item) => {
          const label = t(item.labelKey);
          const to = basePath + item.toSuffix;
          return (
            <SidebarMenuItem key={item.labelKey}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.toSuffix, item.end)}
                tooltip={label}
              >
                <NavLink to={to} end={item.end}>
                  <item.icon />
                  <span>{label}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
