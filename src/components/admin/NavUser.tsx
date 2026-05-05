import { NavLink } from "react-router-dom";
import {
  ChevronsUpDown,
  LogOut,
  User,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
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
import { useTheme } from "@/contexts/ThemeContext";

export function NavUser() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "SM";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu modal={isMobile}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                  <AvatarImage
                    src={profile?.avatar_url || ""}
                    alt={t("nav.myProfile")}
                  />
                  <AvatarFallback className="rounded-lg bg-card text-foreground text-xs">
                    {getInitials(profile?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {profile?.name || t("nav.myProfile")}
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
              {/* User info header */}
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                    <AvatarImage src={profile?.avatar_url || ""} alt={t("nav.myProfile")} />
                    <AvatarFallback className="rounded-lg bg-card text-foreground text-xs">
                      {getInitials(profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {profile?.name || t("nav.myProfile")}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <NavLink
                    to="/admin/profile"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                    <span>{t("nav.myProfile")}</span>
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    <span>{t("nav.darkMode")}</span>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    className="scale-75"
                  />
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={async (e) => {
                    e.preventDefault();
                    await signOut();
                    window.location.href = "/";
                  }}
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
