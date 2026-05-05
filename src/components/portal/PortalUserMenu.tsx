import { useNavigate, useParams } from "react-router-dom";
import { ChevronsUpDown, LogOut, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { usePortal } from "@/contexts/PortalContext";

export function PortalUserMenu() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { customer, tenant } = usePortal();
  const { slug } = useParams<{ slug: string }>();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut();
    navigate(`/${slug}/login`, { replace: true });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarFallback className="rounded-lg bg-card text-foreground text-xs">
                  {getInitials(customer.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{customer.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {customer.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-card border-border rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-card text-foreground text-xs">
                    {getInitials(customer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">
                    {customer.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {customer.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => navigate(`/${slug}/store`)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t("portal.userMenu.backToStore")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleLogout}
                className="flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t("nav.logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
