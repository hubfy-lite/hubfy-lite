import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { translateAppError } from "@/lib/app-error-utils";
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";

export default function TeamSettingsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { members, loading, actionLoading, addMember, resendInvite, removeMember } =
    useTeamMembers();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "owner">("editor");
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const currentUserId = user?.id;
  const isCurrentUserOwner = members.some(
    (m) => m.user_id === currentUserId && m.role === "owner"
  );

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    // Client-side: block self-invite
    if (user?.email && inviteEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      toast({
        variant: "destructive",
        title: t("settings.team.selfInviteBlocked", "Você já faz parte deste workspace"),
      });
      return;
    }

    try {
      await addMember({ email: inviteEmail.trim(), role: inviteRole });
      toast({
        variant: "success",
        title: t("settings.team.inviteSuccess"),
      });
      setInviteEmail("");
      setInviteRole("editor");
      setInviteOpen(false);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: t("settings.team.inviteError"),
        description: translateAppError(error, t("settings.team.genericError")),
      });
    }
  };

  const handleRemove = async (member: TeamMember) => {
    try {
      await removeMember(member.user_id);
      toast({
        variant: "success",
        title: t("settings.team.removeSuccess"),
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: t("settings.team.removeError"),
        description: translateAppError(error, t("settings.team.genericError")),
      });
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      await resendInvite(member.user_id);
      toast({
        variant: "success",
        title: t("settings.team.resendInviteSuccess"),
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: t("settings.team.resendInviteError"),
        description: translateAppError(error, t("settings.team.genericError")),
      });
    }
  };

  const getInitials = (name: string) => {
    return (name || "U").charAt(0).toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    if (role === "owner") {
      return (
        <Badge variant="blue">
          {t("settings.team.roleOwner")}
        </Badge>
      );
    }
    return (
      <Badge variant="purple">
        {t("settings.team.roleEditor")}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card variant="bordered">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="bordered">
      <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.team.title")}</CardTitle>

          {isCurrentUserOwner && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                  {t("settings.team.inviteButton")}
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("settings.team.inviteTitle")}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("settings.team.emailLabel")}
                  </label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInvite();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("settings.team.roleLabel")}
                  </label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as "editor" | "owner")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">
                        {t("settings.team.roleEditor")}
                      </SelectItem>
                      <SelectItem value="owner">
                        {t("settings.team.roleOwner")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || actionLoading}
                >
                  {actionLoading && <Loader2 className="size-4 animate-spin" />}
                  {t("settings.team.sendInvite")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
      </CardHeader>

      <CardContent className="space-y-1">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("settings.team.noMembers")}
          </p>
        ) : (
          members.map((member) => {
            const isSelf = member.user_id === currentUserId;
            const canRemove = isCurrentUserOwner && !isSelf;

            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between py-3 px-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-9 shrink-0">
                    {member.avatar_url && (
                      <AvatarImage src={member.avatar_url} alt={member.name} />
                    )}
                    <AvatarFallback className="text-xs">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.name}
                      {isSelf && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({t("settings.team.you")})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {member.status === "pending" && (
                    <span className="text-sm text-muted-foreground">
                      {t("settings.team.statusPending")}
                    </span>
                  )}
                  {getRoleBadge(member.role)}

                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isCurrentUserOwner && member.status === "pending" && (
                        <DropdownMenuItem
                          disabled={actionLoading}
                          onClick={() => handleResendInvite(member)}
                        >
                          {t("settings.team.resendInvite")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={!canRemove}
                        className={canRemove ? "text-destructive focus:text-destructive" : ""}
                        onClick={() => {
                          // Fecha o dropdown antes, abre o AlertDialog no próximo frame
                          requestAnimationFrame(() => setMemberToRemove(member));
                        }}
                      >
                        {t("settings.team.removeAction")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* AlertDialog fora do DropdownMenu para evitar bug de overlay travado */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => { if (!open) setMemberToRemove(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.team.removeConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.team.removeConfirmDescription", {
                name: memberToRemove?.name || memberToRemove?.email || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (memberToRemove) handleRemove(memberToRemove);
              }}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="size-4 animate-spin" />}
              {t("settings.team.removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
