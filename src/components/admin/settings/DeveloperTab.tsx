import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatDateOnly } from "@/lib/utils";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import {
  Copy,
  Check,
  Plus,
  Loader2,
  MoreHorizontal,
  AlertTriangle,
  BookOpen,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useApiKeys, type ApiKey } from "@/hooks/useApiKeys";
import { translateAppError } from "@/lib/app-error-utils";

function formatRelativeTime(dateStr: string | null, never: string): string {
  if (!dateStr) return never;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d atrás`;
  return date.toLocaleDateString("pt-BR");
}

export default function DeveloperTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { toast } = useToast();
  const { keys, loading, actionLoading, error, createKey, revokeKey } = useApiKeys();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");

  // Created key reveal dialog
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState("");
  const [copied, setCopied] = useState(false);

  // Revoke dialog
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  const handleCreate = async () => {
    try {
      const result = await createKey(label || undefined);
      setCreateOpen(false);
      setLabel("");
      setRevealedKey(result.api_key);
      setRevealOpen(true);
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: translateAppError(err),
      });
    }
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    try {
      await revokeKey(keyToRevoke.id);
      setKeyToRevoke(null);
      toast({ title: t("settings.developer.revokeSuccess") });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: translateAppError(err),
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card variant="bordered">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.developer.title")}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/docs">
                <BookOpen className="size-4" />
                {t("settings.developer.viewDocs", "View API docs")}
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={actionLoading}
            >
              <Plus className="size-4" />
              {t("settings.developer.createButton")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertTriangle className="size-10 text-destructive/50 mb-3" />
              <p className="text-sm font-medium text-foreground">
                {t("common.error")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {error.message}
              </p>
            </div>
          ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Key className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">
                {t("settings.developer.empty")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.developer.emptyDescription")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.developer.prefix")}</TableHead>
                  <TableHead>{t("settings.developer.label")}</TableHead>
                  <TableHead>{t("settings.developer.createdAt")}</TableHead>
                  <TableHead>{t("settings.developer.lastUsed")}</TableHead>
                  <TableHead className="w-11" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="text-sm">
                      {key.key_prefix}••••••••
                    </TableCell>
                    <TableCell>{key.label || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateOnly(key.created_at, lang)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(
                        key.last_used_at,
                        t("settings.developer.never")
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setKeyToRevoke(key)}
                          >
                            {t("settings.developer.revokeAction")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {revokedKeys.map((key) => (
                  <TableRow key={key.id} className="opacity-50">
                    <TableCell className="text-sm">
                      {key.key_prefix}••••••••
                    </TableCell>
                    <TableCell>
                      {key.label || "—"}{" "}
                      <Badge variant="outline" className="ml-1 text-xs">
                        {t("settings.developer.revoked")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateOnly(key.created_at, lang)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ──────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.developer.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("settings.developer.labelField")}
              </label>
              <Input
                {...NO_AUTOFILL_PROPS}
                placeholder={t("settings.developer.labelPlaceholder")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={actionLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {t("settings.developer.createButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal Dialog ──────────────────── */}
      <Dialog
        open={revealOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRevealOpen(false);
            setRevealedKey("");
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.developer.createdTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <AlertTriangle className="size-4 text-warning shrink-0" />
              <p className="text-sm text-muted-foreground">
                {t("settings.developer.createdWarning")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={revealedKey}
                readOnly
                variant="readOnly"
                className="text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => copyToClipboard(revealedKey)}
              >
                {copied ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealOpen(false);
                setRevealedKey("");
                setCopied(false);
              }}
            >
              {t("settings.developer.understood")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Confirmation ────────────── */}
      <AlertDialog
        open={!!keyToRevoke}
        onOpenChange={(open) => !open && setKeyToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.developer.revokeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.developer.revokeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t("settings.developer.revokeAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
