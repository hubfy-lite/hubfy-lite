import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePortal } from "@/contexts/PortalContext";
import { PortalNav } from "@/components/portal/PortalNav";
import { PortalUserMenu } from "@/components/portal/PortalUserMenu";

export function PortalSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { tenant } = usePortal();

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={tenant.icon_url || undefined} alt={tenant.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {tenant.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden">
            {tenant.name}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <PortalNav />
      </SidebarContent>
      <SidebarFooter>
        <PortalUserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
