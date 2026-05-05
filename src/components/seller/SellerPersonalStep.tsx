import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PhoneInput } from "./PhoneInput";
import type { Seller } from "@/types/seller";

/** Format CPF digits as 000.000.000-00 */
function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/** Mask CPF while typing */
function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return formatCpf(digits);
}

/** Mask CEP while typing: 00000-000 */
function maskCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Validate CPF checksum */
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

interface SellerPersonalStepProps {
  seller: Seller;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onNext: () => void;
}

function AddressFields({
  prefix,
  form,
  onCepComplete,
  cepLoading,
}: {
  prefix: string;
  form: any;
  onCepComplete?: (cep: string) => void;
  cepLoading?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* CEP — primeiro item */}
      <FormField
        control={form.control}
        name={`${prefix}.postal_code`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("seller.fields.postalCode")}</FormLabel>
            <FormControl>
              <Input
                placeholder="00000-000"
                maxLength={9}
                value={field.value}
                onChange={(e) => {
                  const masked = maskCep(e.target.value);
                  field.onChange(masked);
                  const digits = masked.replace(/\D/g, "");
                  if (digits.length === 8 && onCepComplete) {
                    onCepComplete(digits);
                  }
                }}
              />
            </FormControl>
            {cepLoading && (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-[1fr_80px] gap-4">
        <FormField
          control={form.control}
          name={`${prefix}.line1`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller.fields.addressLine1")}</FormLabel>
              <FormControl><Input placeholder={t("seller.fields.addressLine1Placeholder")} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${prefix}.line2`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller.fields.addressLine2")}</FormLabel>
              <FormControl><Input placeholder="123" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`${prefix}.line3`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller.fields.addressLine3")} ({t("common.optional")})</FormLabel>
              <FormControl><Input placeholder="Apto 101" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${prefix}.neighborhood`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller.fields.neighborhood")}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`${prefix}.city`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller.fields.city")}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${prefix}.state`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller.fields.state")}</FormLabel>
              <FormControl>
                <Input placeholder="SP" maxLength={2} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

export function SellerPersonalStep({ seller, onSave, onNext }: SellerPersonalStepProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const cepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cpfValue, setCpfValue] = useState(
    seller.taxpayer_id ? maskCpf(seller.taxpayer_id) : ""
  );
  const [cpfTouched, setCpfTouched] = useState(false);

  const cpfDigits = cpfValue.replace(/\D/g, "");
  const cpfHasMinLength = cpfDigits.length === 11;
  const cpfIsValid = isValidCpf(cpfDigits);
  const showCpfError = cpfTouched && (cpfDigits.length === 0 || (cpfHasMinLength && !cpfIsValid));

  const form = useForm({
    defaultValues: {
      first_name: seller.first_name ?? "",
      last_name: seller.last_name ?? "",
      email: seller.email ?? "",
      phone_number: seller.phone_number ?? "",
      birthdate: seller.birthdate ?? "",
      address: {
        line1: seller.address_line1 ?? "",
        line2: seller.address_line2 ?? "",
        line3: seller.address_line3 ?? "",
        neighborhood: seller.address_neighborhood ?? "",
        city: seller.address_city ?? "",
        state: seller.address_state ?? "",
        postal_code: seller.address_postal_code ? maskCep(seller.address_postal_code) : "",
        country_code: seller.address_country_code ?? "BR",
      },
    },
  });

  const fetchCep = useCallback(
    (cep: string) => {
      if (cepTimerRef.current) clearTimeout(cepTimerRef.current);
      cepTimerRef.current = setTimeout(async () => {
        setCepLoading(true);
        try {
          const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
          if (!res.ok) throw new Error("CEP not found");
          const data = await res.json();
          if (data.street) form.setValue("address.line1", data.street);
          if (data.neighborhood) form.setValue("address.neighborhood", data.neighborhood);
          if (data.city) form.setValue("address.city", data.city);
          if (data.state) form.setValue("address.state", data.state);
        } catch {
          // CEP inválido ou sem resultado — user preenche manualmente
        } finally {
          setCepLoading(false);
        }
      }, 500);
    },
    [form]
  );

  const handleNext = async () => {
    // CPF is required for both PF and PJ (responsável legal)
    if (cpfDigits.length === 0) {
      setCpfTouched(true);
      toast.error(t("seller.validation.cpfRequired"));
      return;
    }
    if (!cpfIsValid) {
      setCpfTouched(true);
      toast.error(t("seller.validation.invalidCpf"));
      return;
    }

    // Validate age 18+
    const birthdate = form.getValues("birthdate");
    if (birthdate) {
      const birth = new Date(birthdate);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear() -
        (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
      if (age < 18) {
        toast.error(t("seller.errors.underage"));
        return;
      }
    }

    setSaving(true);
    try {
      const data = form.getValues();
      const payload: Record<string, unknown> = {
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        taxpayer_id: cpfDigits || null,
        email: data.email || null,
        phone_number: data.phone_number ? data.phone_number.replace(/\D/g, "") : null,
        birthdate: data.birthdate || null,
        // Address
        address_line1: data.address.line1 || null,
        address_line2: data.address.line2 || null,
        address_line3: data.address.line3 || null,
        address_neighborhood: data.address.neighborhood || null,
        address_city: data.address.city || null,
        address_state: data.address.state ? data.address.state.toUpperCase() : null,
        address_postal_code: data.address.postal_code ? data.address.postal_code.replace(/\D/g, "") : null,
        address_country_code: data.address.country_code || "BR",
      };

      await onSave(payload);
      onNext();
    } catch (err: any) {
      toast.error(err.message || t("seller.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-normal text-foreground md:text-xl">
          {t("seller.steps.personal.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("seller.steps.personal.description")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.firstName")}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.lastName")}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* CPF */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("seller.fields.cpf")}</label>
            <Input
              placeholder="000.000.000-00"
              value={cpfValue}
              onChange={(e) => {
                setCpfValue(maskCpf(e.target.value));
                setCpfTouched(true);
              }}
              onBlur={() => setCpfTouched(true)}
              maxLength={14}
            />
            {showCpfError && (
              <p className="text-sm text-destructive">
                {cpfDigits.length === 0
                  ? t("seller.validation.cpfRequired")
                  : t("seller.validation.invalidCpf")}
              </p>
            )}
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.email")}</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.phone")}</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="birthdate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.birthdate")}</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Endereço do responsável ── */}
          <div className="pt-12 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              {t("seller.sections.personalAddress")}
            </h3>
            <AddressFields
              prefix="address"
              form={form}
              onCepComplete={fetchCep}
              cepLoading={cepLoading}
            />
          </div>

          <div className="pt-4">
            <Button
              type="button"
              className="w-full"
              onClick={handleNext}
              disabled={saving}
            >
              {saving ? t("common.saving") : t("common.next")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
