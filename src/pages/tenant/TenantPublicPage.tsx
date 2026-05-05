import { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTenantBySlug } from "@/hooks/useTenantBySlug";
import { TenantNavbar } from "@/components/tenant/TenantNavbar";
import { useAuth } from "@/contexts/AuthContext";

export default function TenantPublicPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading, error } = useTenantBySlug(slug);
  const { user, profile, signOut } = useAuth();

  const handleLoginClick = useCallback(() => {
    navigate(`/${slug}/login`);
  }, [navigate, slug]);

  const handleSignupClick = useCallback(() => {
    navigate(`/${slug}/signup`);
  }, [navigate, slug]);

  const handleLogout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="size-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white gap-4">
        <h1 className="text-2xl font-semibold">{t("tenant.notFound")}</h1>
        <p className="text-white/60">{t("tenant.notFoundHint")}</p>
      </div>
    );
  }

  const heroImage = tenant.hero_image_url || "/images/bg_auth_004.webp";
  const accentColor = tenant.accent_color || "#f59e0b";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Navbar */}
      <TenantNavbar
        tenant={tenant}
        isLoggedIn={!!user}
        customerName={profile?.name}
        customerAvatar={profile?.avatar_url}
        onLoginClick={handleLoginClick}
        onSignupClick={handleSignupClick}
        onLogoutClick={handleLogout}
      />

      {/* Main content — empty hero for now */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        {!user && (
          <div className="mt-8 flex items-center gap-4">
            <button
              className="rounded-xl px-6 py-3 text-white font-medium text-base hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accentColor }}
              onClick={handleSignupClick}
            >
              {t("tenant.startNow")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
