import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User, BookOpen, Users, Settings } from "lucide-react";

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, profile, roles, signOut, isTenant, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-sidebar">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-xl font-semibold">
            <span className="font-semibold">Hubfy</span>
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {profile?.name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground">
            {t("dashboard.greeting", { name: profile?.name?.split(" ")[0] || "usuário" })}
          </h2>
          <p className="text-muted-foreground">
            {t("dashboard.welcome")}
          </p>
        </div>

        {/* Role badges */}
        <div className="mb-6 flex gap-2">
          {roles.map((role) => (
            <span
              key={role}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {t(`dashboard.roles.${role}`)}
            </span>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("dashboard.stats.profile")}
              </span>
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold text-foreground">{t("dashboard.stats.complete")}</div>
            <p className="text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>

          {(isTenant || isAdmin) && (
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("dashboard.stats.products")}
                </span>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold text-foreground">0</div>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.stats.coursesCreated")}
              </p>
            </div>
          )}

          {(isTenant || isAdmin) && (
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("dashboard.stats.students")}
                </span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold text-foreground">0</div>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.stats.enrolled")}
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("dashboard.stats.settings")}
              </span>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button variant="outline" size="sm" className="w-full">
              {t("dashboard.stats.editProfile")}
            </Button>
          </div>
        </div>

        {/* Coming soon notice */}
        <div className="mt-8 rounded-2xl bg-card p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">{t("dashboard.comingSoon")}</h3>
            <p className="text-center text-muted-foreground">
              {t("dashboard.comingSoonDescription")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
