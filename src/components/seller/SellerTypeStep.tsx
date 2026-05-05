import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { COUNTRY_PHONES } from "@/lib/country-phones";
import type { SellerType } from "@/types/seller";

/* ─── Validation helpers ─── */

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rest = sum % 11;
  if (rest < 2) rest = 0;
  else rest = 11 - rest;
  if (rest !== parseInt(digits[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rest = sum % 11;
  if (rest < 2) rest = 0;
  else rest = 11 - rest;
  return rest === parseInt(digits[13]);
}

/* ─── Masks ─── */

function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/* ─── Props ─── */

interface SellerTypeStepProps {
  value?: SellerType;
  onChange: (type: SellerType, document: string) => void;
  isLoading?: boolean;
  /** When true, all fields are read-only (seller already created) */
  locked?: boolean;
  /** The raw document (CPF/CNPJ digits) when locked */
  lockedDoc?: string;
  /** Navigate to next step (used in locked mode) */
  onNext?: () => void;
}

export function SellerTypeStep({
  value,
  onChange,
  isLoading,
  locked,
  lockedDoc,
  onNext,
}: SellerTypeStepProps) {
  const { t } = useTranslation();

  const [sellerType, setSellerType] = useState<SellerType | "">(value ?? "");
  const [docValue, setDocValue] = useState("");
  const [docTouched, setDocTouched] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("BR");
  const [countryOpen, setCountryOpen] = useState(false);

  const isBrazil = selectedCountry === "BR";
  const isCpf = sellerType === "individual";
  const isCnpj = sellerType === "business";
  const rawDoc = docValue.replace(/\D/g, "");

  // For Brazil: standard CPF/CNPJ validation
  // For other countries: always invalid (not supported yet)
  const docIsValid = isBrazil
    ? isCpf
      ? isValidCpf(rawDoc)
      : isCnpj
        ? isValidCnpj(rawDoc)
        : false
    : false; // Non-Brazil always invalid

  const docHasMinLength = isBrazil
    ? isCpf
      ? rawDoc.length === 11
      : rawDoc.length === 14
    : rawDoc.length >= 3; // For non-BR, show error after 3+ chars typed

  const showError = docTouched && docHasMinLength && !docIsValid;
  const canContinue = !!sellerType && docIsValid;

  // Individual doc label per country (independent of language)
  const INDIVIDUAL_DOC_MAP: Record<string, string> = {
    BR: "CPF",
    US: "SSN",
    AR: "DNI", PE: "DNI", EC: "DNI",
    MX: "CURP",
    CL: "RUT",
  };

  const BUSINESS_DOC_MAP: Record<string, string> = {
    BR: "CNPJ",
  };

  const getIndividualDocName = () => INDIVIDUAL_DOC_MAP[selectedCountry] ?? "ID";
  const getBusinessDocName = () => BUSINESS_DOC_MAP[selectedCountry] ?? "EIN";

  const getDocLabel = () => {
    if (isCpf) return getIndividualDocName();
    return getBusinessDocName();
  };

  const getDocPlaceholder = () => {
    if (isBrazil) {
      return isCpf ? "000.000.000-00" : "00.000.000/0000-00";
    }
    return "000000000";
  };

  const getDocError = () => {
    const docName = isCpf ? getIndividualDocName() : getBusinessDocName();
    if (isBrazil) {
      return isCpf
        ? t("seller.validation.invalidCpf")
        : t("seller.validation.invalidCnpj");
    }
    return t("seller.validation.invalidGenericDoc", { doc: docName });
  };

  const handleDocChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (isBrazil) {
        setDocValue(isCpf ? maskCpf(raw) : maskCnpj(raw));
      } else {
        // No mask for non-BR countries
        setDocValue(raw);
      }
      setDocTouched(true);
    },
    [isCpf, isBrazil]
  );

  const handleTypeChange = (val: string) => {
    setSellerType(val as SellerType);
    setDocValue("");
    setDocTouched(false);
  };

  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    setCountryOpen(false);
    // Reset doc when country changes
    setDocValue("");
    setDocTouched(false);
  };

  const handleContinueClick = () => {
    setShowConfirmation(true);
    setConfirmed(false);
  };

  const handleConfirm = () => {
    if (!sellerType || !confirmed) return;
    setShowConfirmation(false);
    onChange(sellerType as SellerType, rawDoc);
  };

  const selectedCountryData = COUNTRY_PHONES.find((c) => c.code === selectedCountry);

  /* ─── Locked (read-only) mode ─── */
  if (locked && value) {
    const isIndividual = value === "individual";
    const formattedDoc = lockedDoc
      ? isIndividual
        ? maskCpf(lockedDoc)
        : maskCnpj(lockedDoc)
      : "";

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-normal text-foreground md:text-xl">
            {t("seller.steps.type.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("seller.steps.type.descriptionLocked")}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t("seller.fields.country")}</Label>
          <Input value="🇧🇷 Brasil" disabled className="bg-muted text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <Label>{t("seller.fields.businessType")}</Label>
          <Input
            value={isIndividual ? t("seller.type.individual") : t("seller.type.business")}
            disabled
            className="bg-muted text-muted-foreground"
          />
        </div>

        {formattedDoc && (
          <div className="space-y-2">
            <Label>{isIndividual ? t("seller.fields.cpf") : t("seller.fields.cnpj")}</Label>
            <Input value={formattedDoc} disabled className="bg-muted text-muted-foreground" />
          </div>
        )}

        <Button className="w-full" onClick={onNext}>
          {t("common.next")}
        </Button>
      </div>
    );
  }

  /* ─── Editable mode ─── */
  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-normal text-foreground md:text-xl">
            {t("seller.steps.type.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("seller.steps.type.description")}
          </p>
        </div>

        {/* Country — searchable selector */}
        <div className="space-y-2">
          <Label>{t("seller.fields.country")}</Label>
          <Popover open={countryOpen} onOpenChange={setCountryOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={countryOpen}
                className="w-full justify-between font-normal"
              >
                {selectedCountryData ? (
                  <span className="flex items-center gap-2">
                    <span className="text-base leading-none">{selectedCountryData.flag}</span>
                    <span>{selectedCountryData.name}</span>
                  </span>
                ) : (
                  t("seller.fields.country")
                )}
                <ChevronsUpDown className="size-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder={t("common.search")} />
                <CommandList>
                  <CommandEmpty>{t("common.none")}</CommandEmpty>
                  <CommandGroup>
                    {COUNTRY_PHONES.map((c) => (
                      <CommandItem
                        key={c.code}
                        value={`${c.name} ${c.code}`}
                        onSelect={() => handleCountryChange(c.code)}
                      >
                        <span className="mr-2 text-base">{c.flag}</span>
                        <span className="flex-1 truncate text-sm">{c.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Seller type */}
        <div className="space-y-2">
          <Label>{t("seller.fields.businessType")}</Label>
          <Select value={sellerType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("seller.fields.businessTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">
                {t("seller.type.individual")}
              </SelectItem>
              <SelectItem value="business">
                {t("seller.type.business")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Document input (CPF/CNPJ for BR, Taxpayer ID/EIN for others) */}
        {sellerType && (
          <div className="space-y-2">
            <Label>{getDocLabel()}</Label>
            <Input
              placeholder={getDocPlaceholder()}
              value={docValue}
              onChange={handleDocChange}
              onBlur={() => setDocTouched(true)}
              maxLength={isBrazil ? (isCpf ? 14 : 18) : 50}
            />
            {showError && (
              <p className="text-sm text-destructive">
                {getDocError()}
              </p>
            )}
          </div>
        )}

        {/* Continue button */}
        <Button
          className="w-full"
          disabled={!canContinue || isLoading}
          onClick={handleContinueClick}
        >
          {isLoading ? t("common.saving") : t("common.next")}
        </Button>
      </div>

      {/* Confirmation modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              <DialogTitle>{t("seller.confirmation.title")}</DialogTitle>
            </div>
            <DialogDescription className="text-left leading-relaxed">
              {t("seller.confirmation.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id="confirm-irreversible"
              checked={confirmed}
              onCheckedChange={(val) => setConfirmed(val === true)}
            />
            <label
              htmlFor="confirm-irreversible"
              className="text-sm leading-5 cursor-pointer select-none"
            >
              {t("seller.confirmation.checkbox")}
            </label>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={!confirmed || isLoading} onClick={handleConfirm}>
              {isLoading ? t("common.saving") : t("common.next")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
