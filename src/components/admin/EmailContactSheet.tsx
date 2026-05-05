import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { translateAppError } from "@/lib/app-error-utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Customer, AddCustomerData, UpdateCustomerData } from "@/hooks/useCustomers";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import {
  ALLOWED_DOCUMENT_TYPES,
  buildFullName,
} from "@/lib/customer-helpers";

interface EmailContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  onAdd: (data: AddCustomerData) => Promise<unknown>;
  onUpdate: (userId: string, data: UpdateCustomerData) => Promise<void>;
}

export default function EmailContactSheet({
  open,
  onOpenChange,
  customers,
  onAdd,
  onUpdate,
}: EmailContactSheetProps) {
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+55");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [document, setDocument] = useState("");

  const [saving, setSaving] = useState(false);
  const [duplicateCustomer, setDuplicateCustomer] = useState<Customer | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Reset form when sheet opens/closes
  useEffect(() => {
    if (!open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneCountryCode("+55");
      setPhoneNumber("");
      setCity("");
      setRegion("");
      setCountry("");
      setDocumentType("");
      setDocument("");
      setDuplicateCustomer(null);
    }
  }, [open]);

  const buildFormData = () => {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const fullName = limitNameLength(
      buildFullName(normalizedFirstName, normalizedLastName),
    );

    return {
      name: fullName,
      first_name: normalizedFirstName || undefined,
      last_name: normalizedLastName || undefined,
      phone: phoneNumber.trim()
        ? `${phoneCountryCode.trim()} ${phoneNumber.trim()}`
        : undefined,
      city: city.trim() || undefined,
      region: region.trim() || undefined,
      country: country.trim() || undefined,
      document_type: documentType.trim().toUpperCase() || undefined,
      document: document.trim() || undefined,
    };
  };

  const handleSave = async () => {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const fullName = limitNameLength(
      buildFullName(normalizedFirstName, normalizedLastName),
    );
    const normalizedEmail = email.trim().toLowerCase();

    if (!fullName) {
      toast.error(t("customerSheet.nameRequired"));
      return;
    }

    if (!normalizedEmail) {
      toast.error(t("customerSheet.emailRequired"));
      return;
    }

    if (!normalizedEmail.includes("@")) {
      toast.error(t("customerSheet.emailInvalid"));
      return;
    }

    // Client-side duplicate check
    const existing = customers.find(
      (c) => c.email.toLowerCase() === normalizedEmail,
    );
    if (existing) {
      setDuplicateCustomer(existing);
      return;
    }

    setSaving(true);
    try {
      await onAdd({
        email: normalizedEmail,
        ...buildFormData(),
      });
      toast.success(t("emailContactSheet.contactAdded"));
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("emailContactSheet.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExisting = async () => {
    if (!duplicateCustomer) return;
    setSaving(true);
    try {
      await onUpdate(duplicateCustomer.user_id, buildFormData());
      toast.success(t("emailContactSheet.contactUpdated"));
      setDuplicateCustomer(null);
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("emailContactSheet.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const docConfig: Record<string, { placeholder: string; inputMode: "numeric" | "text" }> = {
    CPF: { placeholder: "000.000.000-00", inputMode: "numeric" },
    CNPJ: { placeholder: "00.000.000/0000-00", inputMode: "numeric" },
    PASSPORT: { placeholder: "AB123456", inputMode: "text" },
    DNI: { placeholder: "12345678X", inputMode: "text" },
    ID: { placeholder: "123456789", inputMode: "text" },
    RUT: { placeholder: "12.345.678-9", inputMode: "numeric" },
    EIN: { placeholder: "12-3456789", inputMode: "numeric" },
    VAT: { placeholder: "XX123456789", inputMode: "text" },
  };

  const currentDocConfig = docConfig[documentType] ?? {
    placeholder: t("customerSheet.documentPlaceholder"),
    inputMode: "text" as const,
  };

  const handleChangeEmail = () => {
    setDuplicateCustomer(null);
    setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col !max-w-[540px] !bg-card !border-l-0">
          <SheetHeader>
            <SheetTitle>{t("emailContactSheet.title")}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 py-2 overflow-y-auto px-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-first-name">
                {t("customerSheet.firstNameLabel")}
              </Label>
              <Input
                id="contact-first-name"
                placeholder={t("customerSheet.firstNamePlaceholder")}
                value={firstName}
                onChange={(e) => setFirstName(limitNameLength(e.target.value))}
                maxLength={FRONTEND_NAME_MAX_LENGTH}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-last-name">
                {t("customerSheet.lastNameLabel")}
              </Label>
              <Input
                id="contact-last-name"
                placeholder={t("customerSheet.lastNamePlaceholder")}
                value={lastName}
                onChange={(e) => setLastName(limitNameLength(e.target.value))}
                maxLength={FRONTEND_NAME_MAX_LENGTH}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">
                {t("customerSheet.emailLabel")}
              </Label>
              <Input
                ref={emailInputRef}
                id="contact-email"
                type="email"
                placeholder={t("customerSheet.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone-number">
                {t("customerSheet.phoneLabel")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="contact-phone-code"
                  placeholder="+55"
                  value={phoneCountryCode}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (v && !v.startsWith("+")) v = "+" + v;
                    setPhoneCountryCode(v);
                  }}
                  inputMode="tel"
                  className="w-[30%] shrink-0"
                  maxLength={5}
                />
                <Input
                  id="contact-phone-number"
                  placeholder="11 99999-9999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  inputMode="tel"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-city">
                {t("customerSheet.cityLabel")}
              </Label>
              <Input
                id="contact-city"
                placeholder={t("customerSheet.cityPlaceholder")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-region">
                  {t("customerSheet.regionLabel")}
                </Label>
                <Input
                  id="contact-region"
                  placeholder={t("customerSheet.regionPlaceholder")}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-country">
                  {t("customerSheet.countryLabel")}
                </Label>
                <Input
                  id="contact-country"
                  placeholder={t("customerSheet.countryPlaceholder")}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-document-type">
                  {t("customerSheet.documentTypeLabel")}
                </Label>
                <Select
                  value={documentType || undefined}
                  onValueChange={(value) => setDocumentType(value)}
                >
                  <SelectTrigger id="contact-document-type">
                    <SelectValue
                      placeholder={t("customerSheet.documentTypePlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOWED_DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {dt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-document">
                  {t("customerSheet.documentLabel")}
                </Label>
                <Input
                  id="contact-document"
                  placeholder={currentDocConfig.placeholder}
                  inputMode={currentDocConfig.inputMode}
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                />
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t("emailContactSheet.add")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Duplicate email dialog */}
      <AlertDialog
        open={!!duplicateCustomer}
        onOpenChange={(o) => !o && handleChangeEmail()}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("emailContactSheet.duplicateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("emailContactSheet.duplicateDescription", {
                email: duplicateCustomer?.email,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} onClick={handleChangeEmail}>
              {t("emailContactSheet.changeEmail")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                handleUpdateExisting();
              }}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t("emailContactSheet.updateData")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
