import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { PublicTenant } from "@/hooks/useTenantBySlug";

interface TenantNavbarProps {
  tenant: PublicTenant;
  isLoggedIn: boolean;
  customerName?: string | null;
  customerAvatar?: string | null;
  onLoginClick: () => void;
  onSignupClick: () => void;
  onLogoutClick: () => void;
}

export function TenantNavbar({
  tenant,
  isLoggedIn,
  customerName,
  customerAvatar,
  onLoginClick,
  onSignupClick,
  onLogoutClick,
}: TenantNavbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accentColor = tenant.accent_color || "#f59e0b";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/30 backdrop-blur-md">
      {/* Left: avatar + name */}
      <div className="flex items-center gap-3">
        <Avatar className="size-9 border-2 border-white/20">
          <AvatarImage src={tenant.icon_url || undefined} alt={tenant.name} />
          <AvatarFallback className="bg-white/10 text-white text-sm font-semibold">
            {tenant.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-white font-semibold text-base">{tenant.name}</span>
      </div>

      {/* Right: CTAs or customer info */}
      <div className="flex items-center gap-3">
        {isLoggedIn ? (
          <>
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarImage src={customerAvatar || undefined} />
                <AvatarFallback className="bg-white/10 text-white text-xs">
                  {customerName?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-white text-sm hidden sm:inline">{customerName}</span>
            </div>
            <Button
              size="sm"
              className="text-white font-medium hover:opacity-90"
              style={{ backgroundColor: accentColor }}
              onClick={() => navigate(`/${tenant.slug}`)}
            >
              {t("portal.myPortal")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={onLogoutClick}
            >
              {t("tenant.navbar.logout")}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="border-white/30 text-white bg-transparent hover:bg-white/10 hover:border-white/50"
              onClick={onLoginClick}
            >
              {t("tenant.navbar.login")}
            </Button>
            <Button
              size="sm"
              className="text-white font-medium hover:opacity-90"
              style={{ backgroundColor: accentColor }}
              onClick={onSignupClick}
            >
              {t("tenant.navbar.signup")}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
