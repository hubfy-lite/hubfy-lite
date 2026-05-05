import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { User, LogOut, LayoutDashboard, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";
import { ThemeSwitcher } from "@/components/auth/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";

interface CustomerPortalHeaderProps {
  tenantName: string;
  tenantSlug: string;
  tenantIconUrl?: string | null;
  tenantIconName?: string | null;
  tenantIconColor?: string | null;
  onSignOut: () => Promise<void> | void;
  /** Exibe link "Portal do cliente" no dropdown. Usar true na página do curso/aula. */
  showPortalLink?: boolean;
  userId?: string | null;
  /** Destino do clique no branding (esquerda). Padrão: /${tenantSlug} */
  brandingHref?: string;
}

export function CustomerPortalHeader({
  tenantName,
  tenantSlug,
  tenantIconUrl,
  tenantIconName,
  tenantIconColor,
  onSignOut,
  showPortalLink = false,
  userId,
  brandingHref,
}: CustomerPortalHeaderProps) {
  const { t } = useTranslation();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, onSignOut]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 md:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] 3xl:max-w-[1600px] items-center justify-between gap-4 py-4 md:py-5">
        {/* Esquerda: branding do tenant */}
        <Link
          to={brandingHref ?? `/${tenantSlug}`}
          className="flex min-w-0 items-center gap-3"
        >
          <WorkspaceAvatar
            iconUrl={tenantIconUrl}
            iconName={tenantIconName}
            iconColor={tenantIconColor}
            size="md"
          />
          <span className="truncate text-sm font-medium">
            {tenantName}
          </span>
        </Link>

        {/* Direita: tema + idioma + menu do usuário */}
        <div className="flex items-center gap-1.5">
          <ThemeSwitcher />
          <LanguageSwitcher userId={userId} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isSigningOut}
                className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {isSigningOut ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <User className="size-4" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {showPortalLink && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      to={`/${tenantSlug}`}
                      className="flex items-center gap-2"
                    >
                      <LayoutDashboard className="size-4" />
                      {t("courseShowcase.portal", "Portal do cliente")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" />
                {t("courseShowcase.signOut", "Sair")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
