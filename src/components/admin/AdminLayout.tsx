import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Clock4, Palette, Search, Settings, Sun, CircleDollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTenant } from "@/hooks/useTenant";
import { useSeller } from "@/hooks/useSeller";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { CommandSearch } from "@/components/admin/CommandSearch";
import { MobileGlobalSearch } from "@/components/admin/MobileGlobalSearch";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SellerSummary } from "@/components/seller/SellerSummary";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { seller, isApproved, isPending } = useSeller();
  const { activeWorkspace } = useUserWorkspaces();
  const isOwner = activeWorkspace?.role === "owner";
  const [pendingOpen, setPendingOpen] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ErrorBoundary
      resetKey={location.key}
      onReset={() => navigate(location.pathname + location.search, { replace: true })}
    >
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-4 px-4">
          <SidebarTrigger className="-ml-1" />

          {/* Desktop: inline search with cmdk */}
          <div className="hidden flex-1 md:flex">
            <CommandSearch />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Mobile: search drawer + settings */}
            <div className="flex items-center gap-2 md:hidden">
              <MobileGlobalSearch />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin/settings")}
              >
                <Settings className="size-4" />
              </Button>
            </div>

            {/* Desktop: seller CTA, theme, design, language */}
            <div className="hidden items-center gap-2 md:flex">
              {/* Seller CTA — temporarily hidden, flow preserved at /admin/create-seller */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              >
                <Sun className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin/design")}
                title="Design"
              >
                <Palette className="size-4" />
              </Button>
              <LanguageSwitcher userId={user?.id} />
            </div>
          </div>
        </header>
        <div key={tenant?.id} className="min-w-0 flex-1 animate-fade-in">
            <Outlet />
        </div>
      </SidebarInset>

      {/* Pending seller info dialog */}
      {isPending && seller && (
        <Dialog open={pendingOpen} onOpenChange={setPendingOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("seller.pending.title")}</DialogTitle>
              <DialogDescription>
                {t("seller.pending.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2">
              <SellerSummary seller={seller} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </SidebarProvider>
    </ErrorBoundary>
  );
}
