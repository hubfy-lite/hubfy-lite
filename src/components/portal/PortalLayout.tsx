import { ReactNode, useMemo } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { usePortal } from "@/contexts/PortalContext";

interface PortalLayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const { tenant } = usePortal();

  /* ── Tema dinâmico do tenant ── */
  const tenantStyles = useMemo(() => {
    const styles: Record<string, string> = {};
    if (tenant.primary_color) {
      styles["--portal-primary"] = tenant.primary_color;
    }
    if (tenant.accent_color) {
      styles["--portal-accent"] = tenant.accent_color;
    }
    return styles;
  }, [tenant.primary_color, tenant.accent_color]);

  return (
    <div style={tenantStyles}>
      <SidebarProvider>
        <PortalSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-4 px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
