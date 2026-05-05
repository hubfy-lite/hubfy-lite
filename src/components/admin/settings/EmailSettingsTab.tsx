import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Copy, Check, AlertTriangle, CheckCircle, Globe, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
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
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEmailSettings, useEmailDomain } from "@/hooks/useEmailSettings";

export default function EmailSettingsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { settings, loading } = useEmailSettings();
  const { createDomain, verifyDomain, deleteDomain } = useEmailDomain();

  const [domainInput, setDomainInput] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const domainStatus = settings?.domain_status ?? "not_configured";
  const isVerified = domainStatus === "verified";
  const isPending = domainStatus === "pending";
  const dnsRecords = (settings?.dns_records ?? []) as Array<{
    type: string;
    name: string;
    value: string;
    priority?: number;
  }>;

  const handleCreateDomain = async () => {
    if (!domainInput.trim()) return;
    try {
      await createDomain.mutateAsync({ domain: domainInput.trim() });
      toast({ title: t("email.domain.status.pending") });
      setDomainInput("");
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao criar domínio",
        variant: "destructive",
      });
    }
  };

  const handleVerify = async () => {
    try {
      const result = await verifyDomain.mutateAsync();
      if (result.status === "verified") {
        toast({ title: t("email.domain.status.verified") });
      } else {
        toast({ title: t("email.domain.status.pending"), description: "DNS ainda propagando..." });
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao verificar",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDomain = async () => {
    try {
      await deleteDomain.mutateAsync();
      setShowDeleteDialog(false);
      toast({ title: "Domínio removido" });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao remover",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const statusBadge = () => {
    switch (domainStatus) {
      case "verified":
        return <Badge variant="green"><CheckCircle className="h-3 w-3 mr-1" />{t("email.domain.status.verified")}</Badge>;
      case "pending":
        return <Badge variant="amber"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t("email.domain.status.pending")}</Badge>;
      case "failed":
        return <Badge variant="destructive">{t("email.domain.status.failed")}</Badge>;
      default:
        return <Badge variant="outline">{t("email.domain.status.not_configured")}</Badge>;
    }
  };

  const fieldOrientation = isMobile ? "vertical" as const : "split" as const;

  return (
    <div className="space-y-6">
      {/* ─── Domain Setup ─── */}
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("email.domain.title")}</CardTitle>
            {statusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {domainStatus === "not_configured" ? (
            <Field orientation={fieldOrientation}>
              <FieldContent>
                <FieldLabel>{t("email.domain.inputLabel")}</FieldLabel>
                <FieldDescription>{t("email.domain.description")}</FieldDescription>
              </FieldContent>
              <FieldControl>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("email.domain.inputPlaceholder")}
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateDomain()}
                  />
                  <Button
                    onClick={handleCreateDomain}
                    disabled={!domainInput.trim() || createDomain.isPending}
                    className="shrink-0"
                  >
                    {createDomain.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("email.domain.setup")}
                  </Button>
                </div>
              </FieldControl>
            </Field>
          ) : (
            <>
              <Field orientation={fieldOrientation}>
                <FieldContent>
                  <FieldLabel>{t("email.domain.inputLabel")}</FieldLabel>
                  <FieldDescription>{t("email.domain.description")}</FieldDescription>
                </FieldContent>
                <FieldControl>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{settings?.domain}</span>
                    </div>
                    <div className="flex gap-2">
                      {!isVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleVerify}
                          disabled={verifyDomain.isPending}
                        >
                          {verifyDomain.isPending
                            ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            : <RefreshCw className="h-3 w-3 mr-1" />}
                          Verificar agora
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </FieldControl>
              </Field>

              {/* DNS Records */}
              {dnsRecords.length > 0 && (isPending || !isVerified) && (
                <>
                  <div className="border-t border-border" />
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t("email.domain.dnsDescription")}
                    </p>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-2 text-left font-medium text-xs">{t("email.domain.type")}</th>
                            <th className="p-2 text-left font-medium text-xs">{t("email.domain.name")}</th>
                            <th className="p-2 text-left font-medium text-xs">{t("email.domain.value")}</th>
                            <th className="p-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {dnsRecords.map((record, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2 text-xs">{record.type}</td>
                              <td className="p-2 text-xs max-w-[200px] truncate">{record.name}</td>
                              <td className="p-2 text-xs max-w-[300px] truncate">{record.value}</td>
                              <td className="p-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => copyToClipboard(record.value, i)}
                                >
                                  {copiedIndex === i ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Anti-spam Status ─── */}
      {settings?.suspended && (
        <Card variant="bordered" className="border-destructive/50">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">{t("email.antispam.suspended")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("email.antispam.suspendedReason", { reason: settings.suspended_reason })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("email.antispam.contactSupport")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete domain dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("email.domain.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDomain}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDomain.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
