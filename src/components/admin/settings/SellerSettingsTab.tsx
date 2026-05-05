import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSeller } from "@/hooks/useSeller";
import { useBrazilianBanks } from "@/hooks/useBrazilianBanks";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { SellerStatusBadge } from "@/components/seller/SellerStatusBadge";
import { PhoneInput } from "@/components/seller/PhoneInput";
import type { Seller } from "@/types/seller";

/* ─── Format helpers ─── */

function formatCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatRevenue(value: string | number, locale: string): string {
  const num = typeof value === "string" ? parseInt(value.replace(/\D/g, ""), 10) : value;
  if (!num && num !== 0) return "";
  if (isNaN(num)) return "";
  return new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US").format(num);
}

function parseRevenue(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/* ─── Separator ─── */
function Sep() {
  return <div className="border-t border-border" />;
}

/* ─── Main component ─── */

export default function SellerSettingsTab() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const { seller, loading, saveDraft, canEdit } = useSeller();
  const { activeWorkspace } = useUserWorkspaces();
  const { data: banks, isLoading: banksLoading, error: banksError } = useBrazilianBanks(true);

  const isOwner = activeWorkspace?.role === "owner";
  const editable = isOwner && canEdit;
  const orientation = isMobile ? "vertical" as const : "split" as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasSeller = !!seller;
  const isBusiness = seller?.type === "business";

  return (
    <div className="space-y-6">
      {/* Card 1: Account Info */}
      <AccountInfoCard seller={seller} orientation={orientation} />

      {/* Cards 2-4: only shown when seller exists */}
      {hasSeller && (
        <>
          {/* Card 2: Business Info */}
          <BusinessInfoCard
            seller={seller}
            editable={editable}
            onSave={saveDraft}
            isBusiness={!!isBusiness}
            orientation={orientation}
          />

          {/* Card 3: Legal Representative */}
          <OwnerInfoCard
            seller={seller}
            editable={editable}
            onSave={saveDraft}
            orientation={orientation}
          />

          {/* Card 4: Bank Account */}
          <BankInfoCard
            seller={seller}
            editable={editable}
            onSave={saveDraft}
            banks={banks}
            banksLoading={banksLoading}
            banksError={banksError}
            orientation={orientation}
          />
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Card 1: Account Info (always read-only)
   ══════════════════════════════════════════════ */

function AccountInfoCard({
  seller,
  orientation,
}: {
  seller: Seller | null;
  orientation: "vertical" | "split";
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t("settings.seller.accountInfo.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field orientation={orientation}>
          <FieldContent>
            <FieldLabel>{t("settings.seller.accountInfo.status")}</FieldLabel>
            <FieldDescription>
              {seller
                ? t(`settings.seller.accountInfo.statusHint.${seller.status}`)
                : t("settings.seller.noSeller")}
            </FieldDescription>
          </FieldContent>
          <FieldControl>
            {seller ? (
              seller.status === "draft" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/create-seller")}
                >
                  {t("settings.seller.continueDraft")}
                </Button>
              ) : (
                <SellerStatusBadge status={seller.status} />
              )
            ) : (
              <Button
                variant="accent"
                size="sm"
                onClick={() => navigate("/admin/create-seller")}
              >
                {t("settings.seller.startVerification")}
              </Button>
            )}
          </FieldControl>
        </Field>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════
   Card 2: Business Info
   ══════════════════════════════════════════════ */

function BusinessInfoCard({
  seller,
  editable,
  onSave,
  isBusiness,
  orientation,
}: {
  seller: Seller;
  editable: boolean;
  onSave: (data: Record<string, unknown>) => Promise<any>;
  isBusiness: boolean;
  orientation: "vertical" | "split";
}) {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const currencyLabel = i18n.language === "pt-BR" ? "BRL" : "USD";

  /* ── Form state ── */
  const [businessName, setBusinessName] = useState(seller.business_name ?? "");
  const [firstName, setFirstName] = useState(seller.first_name ?? "");
  const [lastName, setLastName] = useState(seller.last_name ?? "");
  const [bizEmail, setBizEmail] = useState(isBusiness ? (seller.business_email ?? "") : (seller.email ?? ""));
  const [bizPhone, setBizPhone] = useState(isBusiness ? (seller.business_phone ?? "") : (seller.phone_number ?? ""));
  const [revenueDisplay, setRevenueDisplay] = useState(seller.revenue ? formatRevenue(seller.revenue, i18n.language) : "");
  const cnaeDisplay = seller.cnae?.main?.id
    ? `${seller.cnae.main.id} - ${seller.main_activity ?? seller.cnae.main.text}`
    : seller.main_activity ?? "";
  const [openingDate, setOpeningDate] = useState(seller.business_opening_date ?? "");
  const [website, setWebsite] = useState(seller.business_website ?? "");

  // Address
  const addrSrc = isBusiness
    ? { l1: seller.business_address_line1, l2: seller.business_address_line2, l3: seller.business_address_line3, nb: seller.business_address_neighborhood, pc: seller.business_address_postal_code, ci: seller.business_address_city, st: seller.business_address_state, cc: seller.business_address_country_code }
    : { l1: seller.address_line1, l2: seller.address_line2, l3: seller.address_line3, nb: seller.address_neighborhood, pc: seller.address_postal_code, ci: seller.address_city, st: seller.address_state, cc: seller.address_country_code };

  const [addrLine1, setAddrLine1] = useState(addrSrc.l1 ?? "");
  const [addrLine2, setAddrLine2] = useState(addrSrc.l2 ?? "");
  const [addrLine3, setAddrLine3] = useState(addrSrc.l3 ?? "");
  const [addrNeighborhood, setAddrNeighborhood] = useState(addrSrc.nb ?? "");
  const [addrPostalCode, setAddrPostalCode] = useState(addrSrc.pc ?? "");
  const [addrCity, setAddrCity] = useState(addrSrc.ci ?? "");
  const [addrState, setAddrState] = useState(addrSrc.st ?? "");
  const [addrCountry, setAddrCountry] = useState(addrSrc.cc ?? "BR");

  const handleSave = async () => {
    setSaving(true);
    try {
      const revenueInt = parseRevenue(revenueDisplay);
      const payload: Record<string, unknown> = {
        revenue: revenueInt || null,
        business_website: website || null,
      };
      if (isBusiness) {
        const prefix = "business_address_";
        Object.assign(payload, {
          business_name: businessName || null,
          business_email: bizEmail || null,
          business_phone: bizPhone ? bizPhone.replace(/\D/g, "") : null,
          business_opening_date: openingDate || null,
          [`${prefix}line1`]: addrLine1 || null,
          [`${prefix}line2`]: addrLine2 || null,
          [`${prefix}line3`]: addrLine3 || null,
          [`${prefix}neighborhood`]: addrNeighborhood || null,
          [`${prefix}postal_code`]: addrPostalCode || null,
          [`${prefix}city`]: addrCity || null,
          [`${prefix}state`]: addrState ? addrState.toUpperCase() : null,
          [`${prefix}country_code`]: addrCountry || "BR",
        });
      } else {
        Object.assign(payload, {
          first_name: firstName || null,
          last_name: lastName || null,
          email: bizEmail || null,
          phone_number: bizPhone ? bizPhone.replace(/\D/g, "") : null,
          address_line1: addrLine1 || null,
          address_line2: addrLine2 || null,
          address_line3: addrLine3 || null,
          address_neighborhood: addrNeighborhood || null,
          address_postal_code: addrPostalCode || null,
          address_city: addrCity || null,
          address_state: addrState ? addrState.toUpperCase() : null,
          address_country_code: addrCountry || "BR",
        });
      }
      await onSave(payload);
      toast.success(t("settings.general.saved"));
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t("settings.seller.businessInfo.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account type (read-only) */}
        <Field orientation={orientation}>
          <FieldContent>
            <FieldLabel>{t("settings.seller.accountInfo.type")}</FieldLabel>
            <FieldDescription>
              {t("settings.seller.accountInfo.typeHint")}
            </FieldDescription>
          </FieldContent>
          <FieldControl>
            <Input
              value={t(`seller.type.${seller.type}`)}
              variant="readOnly"
              readOnly
              className="font-normal"
            />
          </FieldControl>
        </Field>

        {/* CPF or CNPJ (read-only) */}
        {isBusiness ? (
          seller.ein && (
            <Field orientation={orientation} className="md:items-center">
              <FieldContent>
                <FieldLabel>{t("seller.fields.cnpj")}</FieldLabel>
              </FieldContent>
              <FieldControl>
                <Input value={formatCnpj(seller.ein)} variant="readOnly" readOnly className="font-normal" />
              </FieldControl>
            </Field>
          )
        ) : (
          seller.taxpayer_id && (
            <Field orientation={orientation} className="md:items-center">
              <FieldContent>
                <FieldLabel>{t("seller.fields.cpf")}</FieldLabel>
              </FieldContent>
              <FieldControl>
                <Input value={formatCpf(seller.taxpayer_id)} variant="readOnly" readOnly className="font-normal" />
              </FieldControl>
            </Field>
          )
        )}

        {/* Name / Razão Social */}
        {isBusiness ? (
          <Field orientation={orientation} className="md:items-center">
            <FieldContent>
              <FieldLabel>{t("seller.fields.businessName")}</FieldLabel>
            </FieldContent>
            <FieldControl>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={!editable} />
            </FieldControl>
          </Field>
        ) : (
          <>
            <Field orientation={orientation} className="md:items-center">
              <FieldContent>
                <FieldLabel>{t("seller.fields.firstName")}</FieldLabel>
              </FieldContent>
              <FieldControl>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!editable} />
              </FieldControl>
            </Field>
            <Field orientation={orientation} className="md:items-center">
              <FieldContent>
                <FieldLabel>{t("seller.fields.lastName")}</FieldLabel>
              </FieldContent>
              <FieldControl>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!editable} />
              </FieldControl>
            </Field>
          </>
        )}

        {/* Email */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>
              {isBusiness ? t("seller.fields.businessEmail") : t("settings.seller.businessInfo.commercialEmail")}
            </FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        {/* Phone */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>
              {isBusiness ? t("seller.fields.businessPhone") : t("settings.seller.businessInfo.commercialPhone")}
            </FieldLabel>
          </FieldContent>
          <FieldControl>
            <PhoneInput
              value={bizPhone}
              onChange={setBizPhone}
              disabled={!editable}
            />
          </FieldControl>
        </Field>

        {/* Revenue */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.revenueAnnual")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-xl bg-muted text-muted-foreground text-sm border border-r-0 border-border whitespace-nowrap">
                {currencyLabel}
              </span>
              <Input
                className="rounded-l-none"
                inputMode="numeric"
                placeholder="50.000"
                value={revenueDisplay}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setRevenueDisplay(raw ? formatRevenue(raw, i18n.language) : "");
                }}
                disabled={!editable}
              />
            </div>
          </FieldControl>
        </Field>

        {/* CNAE / Atividade principal (read-only — auto-preenchido) */}
        {cnaeDisplay && (
          <Field orientation={orientation} className="md:items-center">
            <FieldContent>
              <FieldLabel>{t("seller.fields.mainActivity")}</FieldLabel>
            </FieldContent>
            <FieldControl>
              <Input value={cnaeDisplay} variant="readOnly" readOnly className="font-normal" />
            </FieldControl>
          </Field>
        )}

        {/* Opening date (PJ only) */}
        {isBusiness && (
          <Field orientation={orientation} className="md:items-center">
            <FieldContent>
              <FieldLabel>{t("seller.fields.openingDate")}</FieldLabel>
            </FieldContent>
            <FieldControl>
              <Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} disabled={!editable} />
            </FieldControl>
          </Field>
        )}

        {/* Website */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.businessWebsite")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input placeholder="https://seusite.com" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        {/* Address */}
        <Field orientation={orientation}>
          <FieldContent>
            <FieldLabel>{t("settings.seller.businessInfo.address")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <div className="space-y-3">
              <Input placeholder={t("seller.fields.addressLine1Placeholder")} value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} disabled={!editable} />
              <Input placeholder={t("settings.seller.placeholders.number")} value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} disabled={!editable} />
              <Input placeholder={t("settings.seller.placeholders.complement")} value={addrLine3} onChange={(e) => setAddrLine3(e.target.value)} disabled={!editable} />
              <Input placeholder={t("settings.seller.placeholders.neighborhood")} value={addrNeighborhood} onChange={(e) => setAddrNeighborhood(e.target.value)} disabled={!editable} />
            </div>
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.postalCode")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input
              placeholder="01001000"
              maxLength={8}
              value={addrPostalCode}
              onChange={(e) => setAddrPostalCode(e.target.value.replace(/\D/g, ""))}
              disabled={!editable}
            />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.city")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.state")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input placeholder="SP" maxLength={2} value={addrState} onChange={(e) => setAddrState(e.target.value.toUpperCase())} disabled={!editable} />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("settings.seller.businessInfo.country")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input placeholder="BR" maxLength={2} value={addrCountry} onChange={(e) => setAddrCountry(e.target.value.toUpperCase())} disabled={!editable} />
          </FieldControl>
        </Field>

        {editable && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════
   Card 3: Legal Representative / Owner
   ══════════════════════════════════════════════ */

function OwnerInfoCard({
  seller,
  editable,
  onSave,
  orientation,
}: {
  seller: Seller;
  editable: boolean;
  onSave: (data: Record<string, unknown>) => Promise<any>;
  orientation: "vertical" | "split";
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(seller.first_name ?? "");
  const [lastName, setLastName] = useState(seller.last_name ?? "");
  const [email, setEmail] = useState(seller.email ?? "");
  const [phone, setPhone] = useState(seller.phone_number ?? "");
  const [birthdate, setBirthdate] = useState(seller.birthdate ?? "");
  const [addrLine1, setAddrLine1] = useState(seller.address_line1 ?? "");
  const [addrLine2, setAddrLine2] = useState(seller.address_line2 ?? "");
  const [addrLine3, setAddrLine3] = useState(seller.address_line3 ?? "");
  const [addrNeighborhood, setAddrNeighborhood] = useState(seller.address_neighborhood ?? "");
  const [addrPostalCode, setAddrPostalCode] = useState(seller.address_postal_code ?? "");
  const [addrCity, setAddrCity] = useState(seller.address_city ?? "");
  const [addrState, setAddrState] = useState(seller.address_state ?? "");
  const [addrCountry, setAddrCountry] = useState(seller.address_country_code ?? "BR");

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
        phone_number: phone ? phone.replace(/\D/g, "") : null,
        birthdate: birthdate || null,
        address_line1: addrLine1 || null,
        address_line2: addrLine2 || null,
        address_line3: addrLine3 || null,
        address_neighborhood: addrNeighborhood || null,
        address_postal_code: addrPostalCode || null,
        address_city: addrCity || null,
        address_state: addrState ? addrState.toUpperCase() : null,
        address_country_code: addrCountry || "BR",
      });
      toast.success(t("settings.general.saved"));
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t("settings.seller.ownerInfo.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.firstName")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.lastName")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.email")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.phone")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              disabled={!editable}
            />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.birthdate")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        {/* Address */}
        <Field orientation={orientation}>
          <FieldContent>
            <FieldLabel>{t("settings.seller.ownerInfo.address")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <div className="space-y-3">
              <Input placeholder={t("seller.fields.addressLine1Placeholder")} value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} disabled={!editable} />
              <Input placeholder={t("settings.seller.placeholders.number")} value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} disabled={!editable} />
              <Input placeholder={t("settings.seller.placeholders.complement")} value={addrLine3} onChange={(e) => setAddrLine3(e.target.value)} disabled={!editable} />
              <Input placeholder={t("settings.seller.placeholders.neighborhood")} value={addrNeighborhood} onChange={(e) => setAddrNeighborhood(e.target.value)} disabled={!editable} />
            </div>
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.postalCode")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input
              placeholder="01001000"
              maxLength={8}
              value={addrPostalCode}
              onChange={(e) => setAddrPostalCode(e.target.value.replace(/\D/g, ""))}
              disabled={!editable}
            />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.city")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} disabled={!editable} />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.state")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input placeholder="SP" maxLength={2} value={addrState} onChange={(e) => setAddrState(e.target.value.toUpperCase())} disabled={!editable} />
          </FieldControl>
        </Field>

        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("settings.seller.businessInfo.country")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input placeholder="BR" maxLength={2} value={addrCountry} onChange={(e) => setAddrCountry(e.target.value.toUpperCase())} disabled={!editable} />
          </FieldControl>
        </Field>

        {editable && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════
   Card 4: Bank Account
   ══════════════════════════════════════════════ */

function BankInfoCard({
  seller,
  editable,
  onSave,
  banks,
  banksLoading,
  banksError,
  orientation,
}: {
  seller: Seller;
  editable: boolean;
  onSave: (data: Record<string, unknown>) => Promise<any>;
  banks: any;
  banksLoading: boolean;
  banksError: any;
  orientation: "vertical" | "split";
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const [bankCode, setBankCode] = useState(seller.bank_code ?? "");
  const [bankAccountType, setBankAccountType] = useState(seller.bank_account_type ?? "checking");
  const [bankAgency, setBankAgency] = useState(seller.bank_agency ?? "");
  const [bankAccount, setBankAccount] = useState(seller.bank_account ?? "");

  const selectedBankLabel = useMemo(() => {
    if (!bankCode || !banks) return "";
    const bank = banks.find((b: any) => String(b.code) === bankCode);
    return bank ? `${String(bank.code).padStart(3, "0")} - ${bank.name}` : bankCode;
  }, [bankCode, banks]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        bank_code: bankCode || null,
        bank_account_type: bankAccountType,
        bank_agency: bankAgency ? bankAgency.replace(/\D/g, "") : null,
        bank_account: bankAccount || null,
      });
      toast.success(t("settings.general.saved"));
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t("settings.seller.bankInfo.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bank select */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.bank")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            {editable ? (
              <Popover open={bankOpen} onOpenChange={setBankOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bankOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      !bankCode && "text-muted-foreground"
                    )}
                  >
                    {banksLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {t("common.loading")}
                      </span>
                    ) : bankCode ? (
                      <span className="truncate">{selectedBankLabel}</span>
                    ) : (
                      t("seller.fields.bankPlaceholder")
                    )}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("seller.fields.bankSearch")} />
                    <CommandList>
                      <CommandEmpty>
                        {banksError ? t("seller.errors.banksFetchFailed") : t("common.noResults")}
                      </CommandEmpty>
                      <CommandGroup>
                        {(banks ?? []).map((bank: any) => {
                          const code = String(bank.code);
                          const label = `${code.padStart(3, "0")} - ${bank.name}`;
                          return (
                            <CommandItem
                              key={bank.ispb}
                              value={label}
                              onSelect={() => {
                                setBankCode(code);
                                setBankOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 size-4",
                                  bankCode === code ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <Input value={selectedBankLabel || "—"} variant="readOnly" readOnly className="font-normal" />
            )}
          </FieldControl>
        </Field>

        {/* Account Type */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.bankAccountType")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            {editable ? (
              <Select value={bankAccountType} onValueChange={setBankAccountType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">{t("seller.fields.checkingAccount")}</SelectItem>
                  <SelectItem value="savings">{t("seller.fields.savingsAccount")}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={bankAccountType === "savings" ? t("seller.fields.savingsAccount") : t("seller.fields.checkingAccount")}
                variant="readOnly"
                readOnly
                className="font-normal"
              />
            )}
          </FieldControl>
        </Field>

        {/* Agency */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.bankAgency")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input
              placeholder="0001"
              maxLength={10}
              value={bankAgency}
              onChange={(e) => setBankAgency(e.target.value.replace(/[^0-9-]/g, ""))}
              disabled={!editable}
            />
          </FieldControl>
        </Field>

        {/* Account */}
        <Field orientation={orientation} className="md:items-center">
          <FieldContent>
            <FieldLabel>{t("seller.fields.bankAccount")}</FieldLabel>
          </FieldContent>
          <FieldControl>
            <Input
              placeholder="12345-6"
              maxLength={20}
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9-]/g, ""))}
              disabled={!editable}
            />
          </FieldControl>
        </Field>

        {editable && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
