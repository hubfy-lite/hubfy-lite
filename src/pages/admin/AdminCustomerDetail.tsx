import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  DetailSection,
  DetailSectionFooter,
  DangerSection,
  DangerAction,
} from "@/components/admin/DetailPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCustomerDetail } from "@/hooks/useCustomerDetail";
import { usePageTitle } from "@/hooks/usePageTitle";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import { formatDateTime } from "@/lib/utils";
import { translateAppError } from "@/lib/app-error-utils";
import {
  ALLOWED_DOCUMENT_TYPES,
  splitFullName,
  buildFullName,
} from "@/lib/customer-helpers";

/* ─── Main Page ─── */

type Tab = "info";

export default function AdminCustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const { customer, isPending, updateCustomer, removeCustomer } = useCustomerDetail(customerId);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [document, setDocument] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  usePageTitle(customer?.name);

  // Init form from customer
  useEffect(() => {
    if (!customer) return;
    const parsed = splitFullName(customer.name);
    setFirstName(limitNameLength(customer.first_name || parsed.firstName));
    setLastName(limitNameLength(customer.last_name || parsed.lastName));
    setPhone(customer.phone || "");
    setCity(customer.city || "");
    setRegion(customer.region || "");
    setCountry(customer.country || "");
    setDocumentType((customer.document_type || "").toUpperCase());
    setDocument(customer.document || "");
  }, [customer]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!customer) return false;
    const parsed = splitFullName(customer.name);
    const initFirst = limitNameLength(customer.first_name || parsed.firstName);
    const initLast = limitNameLength(customer.last_name || parsed.lastName);
    const initPhone = customer.phone || "";
    const initCity = customer.city || "";
    const initRegion = customer.region || "";
    const initCountry = customer.country || "";
    const initDocType = (customer.document_type || "").toUpperCase();
    const initDoc = customer.document || "";

    return (
      firstName !== initFirst ||
      lastName !== initLast ||
      phone !== initPhone ||
      city !== initCity ||
      region !== initRegion ||
      country !== initCountry ||
      documentType !== initDocType ||
      document !== initDoc
    );
  }, [customer, firstName, lastName, phone, city, region, country, documentType, document]);

  // Save
  const handleSave = async () => {
    if (!customer) return;
    const normalizedFirst = firstName.trim();
    const normalizedLast = lastName.trim();
    const fullName = limitNameLength(buildFullName(normalizedFirst, normalizedLast));
    if (!fullName) { toast.error(t("customerSheet.nameRequired")); return; }

    const normalizedDocType = documentType.trim().toUpperCase();
    const normalizedDoc = document.trim();

    setSaving(true);
    try {
      await updateCustomer(customer.user_id, {
        name: fullName,
        first_name: normalizedFirst || undefined,
        last_name: normalizedLast || undefined,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        region: region.trim() || undefined,
        country: country.trim() || undefined,
        document_type: normalizedDocType || undefined,
        document: normalizedDoc || undefined,
      });
      toast.success(t("customerSheet.customerUpdated"));
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("customerSheet.saveError")));
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!customer) return;
    setDeleting(true);
    try {
      await removeCustomer(customer.user_id);
      queryClient.invalidateQueries({ queryKey: ["tenant-customers"] });
      toast.success(t("customers.actions.removed"));
      navigate("/admin/customers");
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("customers.actions.removeError")));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  /* ── Loading ── */
  if (isPending) {
    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-[1200px] 3xl:max-w-[1600px] space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  /* ── Not Found ── */
  if (!customer) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">{t("customerDetail.notFound")}</p>
          <Button variant="outline" onClick={() => navigate("/admin/customers")}>
            <ArrowLeft className="size-4" />
            {t("customerDetail.backToCustomers")}
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "info", label: t("customerDetail.tabs.info") },
  ];

  const EMAIL_STATUS_VARIANTS: Record<string, BadgeVariant> = {
    subscribed: "green",
    unsubscribed: "gray",
  };

  const handleCopyId = () => {
    if (!customer.public_id) return;
    navigator.clipboard.writeText(customer.public_id);
    toast.success(t("common.idCopied"));
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-[1200px] 3xl:max-w-[1600px] space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0"
              onClick={() => navigate("/admin/customers")}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <h1 className="text-xl font-semibold min-w-0 truncate">{customer.name}</h1>
            <Badge variant={EMAIL_STATUS_VARIANTS[customer.email_marketing_status] ?? EMAIL_STATUS_VARIANTS.unsubscribed}>
              {t(`customers.statusLabels.${customer.email_marketing_status}`, customer.email_marketing_status)}
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="info">
            <TabsList variant="line" className="shrink-0 border-b border-border w-full justify-start">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ─── Tab: Info ─── */}
            <TabsContent value="info" className="mt-8 space-y-0">
              {/* Contact */}
              <DetailSection
                title={t("customerDetail.sectionContactTitle")}
                description={t("customerDetail.sectionContactDesc")}
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {t("common.id", { defaultValue: "ID" })}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={customer.public_id || "—"}
                      variant="readOnly"
                      readOnly
                    />
                    {customer.public_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={handleCopyId}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t("customerSheet.firstNameLabel")}</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(limitNameLength(e.target.value))}
                      placeholder={t("customerSheet.firstNamePlaceholder")}
                      maxLength={FRONTEND_NAME_MAX_LENGTH}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t("customerSheet.lastNameLabel")}</label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(limitNameLength(e.target.value))}
                      placeholder={t("customerSheet.lastNamePlaceholder")}
                      maxLength={FRONTEND_NAME_MAX_LENGTH}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("customerSheet.emailLabel")}</label>
                  <Input value={customer.email} variant="readOnly" readOnly />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("customerSheet.phoneLabel")}</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("customerSheet.phonePlaceholder")}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">{t("common.createdAt", "Criado em")}</label>
                  <Input value={formatDateTime(customer.created_at, lang)} variant="readOnly" readOnly />
                </div>

                <DetailSectionFooter>
                  <Button onClick={handleSave} disabled={saving || !isDirty}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {t("common.save")}
                  </Button>
                </DetailSectionFooter>
              </DetailSection>

              {/* Address */}
              <DetailSection
                title={t("customerDetail.sectionAddressTitle")}
                description={t("customerDetail.sectionAddressDesc")}
                className="pt-8"
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("customerSheet.cityLabel")}</label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t("customerSheet.cityPlaceholder")}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t("customerSheet.regionLabel")}</label>
                    <Input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder={t("customerSheet.regionPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t("customerSheet.countryLabel")}</label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder={t("customerSheet.countryPlaceholder")}
                    />
                  </div>
                </div>

                <DetailSectionFooter>
                  <Button onClick={handleSave} disabled={saving || !isDirty}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {t("common.save")}
                  </Button>
                </DetailSectionFooter>
              </DetailSection>

              {/* Document */}
              <DetailSection
                title={t("customerDetail.sectionDocumentTitle")}
                description={t("customerDetail.sectionDocumentDesc")}
                className="pt-8"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t("customerSheet.documentTypeLabel")}</label>
                    <Select
                      value={documentType || undefined}
                      onValueChange={(value) => setDocumentType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("customerSheet.documentTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {ALLOWED_DOCUMENT_TYPES.map((dt) => (
                          <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t("customerSheet.documentLabel")}</label>
                    <Input
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      placeholder={t("customerSheet.documentPlaceholder")}
                    />
                  </div>
                </div>

                <DetailSectionFooter>
                  <Button onClick={handleSave} disabled={saving || !isDirty}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {t("common.save")}
                  </Button>
                </DetailSectionFooter>
              </DetailSection>

              {/* Danger zone */}
              <DangerSection
                title={t("orderDetail.dangerZone")}
                description={t("customerDetail.sectionDangerDesc")}
                className="pt-8"
              >
                <DangerAction
                  title={t("customerDetail.deleteTitle")}
                  description={t("customerDetail.deleteHint")}
                >
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    {t("common.delete")}
                  </Button>
                </DangerAction>
              </DangerSection>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("customerDetail.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("customerDetail.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("common.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
