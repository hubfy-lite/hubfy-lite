import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sun } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SuperadminSidebar } from "@/components/superadmin/SuperadminSidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface SuperadminLayoutProps {
  children: ReactNode;
}

export default function SuperadminLayout({ children }: SuperadminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ErrorBoundary
      resetKey={location.key}
      onReset={() => navigate(location.pathname + location.search, { replace: true })}
    >
    <SidebarProvider>
      <SuperadminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-4 px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            <Sun className="size-4" />
          </Button>
        </header>
        <div className="min-w-0 flex-1 animate-fade-in">
            {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ErrorBoundary>
  );
}
