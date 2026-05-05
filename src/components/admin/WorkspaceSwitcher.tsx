import { useState } from "react";
import { ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const { workspaces, activeWorkspace, isLoading } = useUserWorkspaces();
  const { user, profile, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const switchWorkspace = async (workspaceId: string) => {
    if (!user || workspaceId === activeWorkspace?.id) return;
    setSwitchingId(workspaceId);
    try {
      const currentPrefs = (profile?.preferences as Record<string, unknown>) ?? {};
      const newPrefs = { ...currentPrefs, default_workspace_id: workspaceId };

      const { error } = await supabase
        .from("profiles")
        .update({ preferences: newPrefs })
        .eq("user_id", user.id);

      if (error) throw error;

      // Fetch the new tenant directly to avoid stale closure in useTenant
      const { data: newTenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (tenantError) throw tenantError;

      updateProfile({ preferences: newPrefs });
      queryClient.setQueriesData(
        { queryKey: ["tenant", user.id] },
        newTenant
      );
      navigate("/admin");
      toast.success(t("workspace.switched"));
    } catch {
      toast.error(t("common.genericError"));
    } finally {
      setSwitchingId(null);
    }
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
              {isLoading ? (
                <Skeleton className="size-8 rounded-lg shrink-0" />
              ) : (
                <WorkspaceAvatar
                  iconUrl={activeWorkspace?.iconUrl}
                  iconName={activeWorkspace?.iconName}
                  iconColor={activeWorkspace?.iconColor}
                  size="md"
                />
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-3 w-12 rounded mt-1" />
                  </>
                ) : (
                  <>
                    <span className="truncate font-medium text-sidebar-foreground">
                      {activeWorkspace?.name || "Workspace"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {activeWorkspace?.plan || "Free"}
                    </span>
                  </>
                )}
              </div>
              <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t("workspace.label")}
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => switchWorkspace(ws.id)}
                disabled={switchingId !== null}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center">
                  {switchingId === ws.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <WorkspaceAvatar
                      iconUrl={ws.iconUrl}
                      iconName={ws.iconName}
                      iconColor={ws.iconColor}
                      size="sm"
                    />
                  )}
                </div>
                <span className="truncate">{ws.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {ws.plan}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => navigate("/admin/new-workspace")}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <span className="text-muted-foreground font-medium">
                {t("workspace.newWorkspace")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
