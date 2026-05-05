import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PhoneInput } from "./PhoneInput";
import type { Seller } from "@/types/seller";

interface CnaeMccRow {
  cnae: string;
  cnae_activity: string;
}

/** Format CNPJ digits as 00.000.000/0000-00 */
function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** Format number with thousand separators based on locale */
function formatRevenue(value: string | number, locale: string): string {
  const num = typeof value === "string" ? parseInt(value.replace(/\D/g, ""), 10) : value;
  if (!num && num !== 0) return "";
  if (isNaN(num)) return "";
  return new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US").format(num);
}

/** Parse formatted revenue string back to integer */
function parseRevenue(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** Mask CEP while typing: 00000-000 */
function maskCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

interface SellerBusinessStepProps {
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

export function SellerBusinessStep({ seller, onSave, onNext }: SellerBusinessStepProps) {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const cepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CNAE state
  const hasCnaeFromApi = !!seller.cnae?.main?.id;
  const [cnaeList, setCnaeList] = useState<CnaeMccRow[]>([]);
  const [cnaeLoading, setCnaeLoading] = useState(false);
  const [cnaeOpen, setCnaeOpen] = useState(false);
  const [selectedCnae, setSelectedCnae] = useState(seller.cnae?.main?.id ?? "");
  const [selectedCnaeActivity, setSelectedCnaeActivity] = useState(seller.main_activity ?? "");

  // Fetch cnae_mcc list only when CNPJA didn't return data
  useEffect(() => {
    if (hasCnaeFromApi) return;
    let cancelled = false;
    setCnaeLoading(true);
    supabase
      .from("cnae_mcc" as any)
      .select("cnae, cnae_activity")
      .then(({ data, error }) => {
        if (cancelled) return;
        setCnaeLoading(false);
        if (error || !data) return;
        // Deduplicate by cnae code (same cnae can map to multiple MCCs)
        const seen = new Set<string>();
        const unique: CnaeMccRow[] = [];
        for (const row of data as CnaeMccRow[]) {
          if (!seen.has(row.cnae)) {
            seen.add(row.cnae);
            unique.push(row);
          }
        }
        unique.sort((a, b) => a.cnae_activity.localeCompare(b.cnae_activity));
        setCnaeList(unique);
      });
    return () => { cancelled = true; };
  }, [hasCnaeFromApi]);

  const cnaeDisplayValue = useMemo(() => {
    if (selectedCnae && selectedCnaeActivity) {
      return `${selectedCnae} - ${selectedCnaeActivity}`;
    }
    return "";
  }, [selectedCnae, selectedCnaeActivity]);

  const currencyLabel = i18n.language === "pt-BR" ? "BRL" : "USD";

  const form = useForm({
    defaultValues: {
      business_name: seller.business_name ?? "",
      ein: seller.ein ?? "",
      business_phone: seller.business_phone ?? "",
      business_email: seller.business_email ?? "",
      business_description: seller.business_description ?? "",
      business_website: seller.business_website ?? "",
      business_opening_date: seller.business_opening_date ?? "",
      revenue_display: seller.revenue ? formatRevenue(seller.revenue, i18n.language) : "",
      business_address: {
        line1: seller.business_address_line1 ?? "",
        line2: seller.business_address_line2 ?? "",
        line3: seller.business_address_line3 ?? "",
        neighborhood: seller.business_address_neighborhood ?? "",
        city: seller.business_address_city ?? "",
        state: seller.business_address_state ?? "",
        postal_code: seller.business_address_postal_code ? maskCep(seller.business_address_postal_code) : "",
        country_code: seller.business_address_country_code ?? "BR",
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
          if (data.street) form.setValue("business_address.line1", data.street);
          if (data.neighborhood) form.setValue("business_address.neighborhood", data.neighborhood);
          if (data.city) form.setValue("business_address.city", data.city);
          if (data.state) form.setValue("business_address.state", data.state);
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
    setSaving(true);
    try {
      const data = form.getValues();
      const revenueInt = parseRevenue(data.revenue_display);

      // Build CNAE payload for manual selection (when CNPJA didn't provide data)
      const cnaePayload: Record<string, unknown> = {};
      if (!hasCnaeFromApi && selectedCnae) {
        cnaePayload.cnae = {
          main: { id: selectedCnae, text: selectedCnaeActivity },
          side: [],
        };
        cnaePayload.main_activity = selectedCnaeActivity;
      }

      await onSave({
        business_name: data.business_name || null,
        ein: data.ein ? data.ein.replace(/\D/g, "") : null,
        business_phone: data.business_phone ? data.business_phone.replace(/\D/g, "") : null,
        business_email: data.business_email || null,
        business_description: data.business_description || null,
        business_website: data.business_website || null,
        business_opening_date: data.business_opening_date || null,
        revenue: revenueInt || null,
        ...cnaePayload,
        // Address
        business_address_line1: data.business_address.line1 || null,
        business_address_line2: data.business_address.line2 || null,
        business_address_line3: data.business_address.line3 || null,
        business_address_neighborhood: data.business_address.neighborhood || null,
        business_address_city: data.business_address.city || null,
        business_address_state: data.business_address.state ? data.business_address.state.toUpperCase() : null,
        business_address_postal_code: data.business_address.postal_code ? data.business_address.postal_code.replace(/\D/g, "") : null,
        business_address_country_code: data.business_address.country_code || "BR",
      });
      onNext();
    } catch (err: any) {
      toast.error(err.message || t("seller.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const lockedCnpj = seller.ein ? formatCnpj(seller.ein) : "";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-normal text-foreground md:text-xl">{t("seller.steps.business.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("seller.steps.business.description")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">

          {/* ══════════════════════════════════════════════
              Seção 1: Dados principais
              ══════════════════════════════════════════════ */}
          <h3 className="text-base font-semibold text-foreground">
            {t("seller.sections.mainDetails")}
          </h3>

          {lockedCnpj && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("seller.fields.cnpj")}</label>
              <Input
                value={lockedCnpj}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
          )}

          <FormField
            control={form.control}
            name="business_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.businessName")}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_opening_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.openingDate")}</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.businessEmail")}</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.businessPhone")}</FormLabel>
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

          {/* ══════════════════════════════════════════════
              Seção 2: Endereço da empresa
              ══════════════════════════════════════════════ */}
          <div className="pt-12 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              {t("seller.sections.businessAddress")}
            </h3>
            <AddressFields
              prefix="business_address"
              form={form}
              onCepComplete={fetchCep}
              cepLoading={cepLoading}
            />
          </div>

          {/* ══════════════════════════════════════════════
              Seção 3: Modelo de negócios
              ══════════════════════════════════════════════ */}
          <div className="pt-12 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              {t("seller.sections.businessModel")}
            </h3>

            <FormField
              control={form.control}
              name="business_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("seller.fields.businessDescription")}</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="revenue_display"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("seller.fields.revenueAnnual")}</FormLabel>
                  <FormControl>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl bg-muted text-muted-foreground text-sm border border-r-0 border-border whitespace-nowrap">
                        {currencyLabel}
                      </span>
                      <Input
                        className="rounded-l-none"
                        inputMode="numeric"
                        placeholder="50.000"
                        value={field.value}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          field.onChange(raw ? formatRevenue(raw, i18n.language) : "");
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Atividade principal (CNAE) */}
            {hasCnaeFromApi ? (
              /* CNPJA returned data → read-only display */
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("seller.fields.mainActivity")}</label>
                <Input
                  value={`${seller.cnae!.main.id} - ${seller.cnae!.main.text}`}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
            ) : (
              /* No CNPJA data → user selects from cnae_mcc table */
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("seller.fields.mainActivity")}</label>
                <Popover open={cnaeOpen} onOpenChange={setCnaeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={cnaeOpen}
                      className={cn(
                        "w-full justify-between font-normal",
                        !selectedCnae && "text-muted-foreground"
                      )}
                    >
                      {cnaeLoading ? (
                        <span className="text-muted-foreground">{t("common.loading")}</span>
                      ) : selectedCnae ? (
                        <span className="truncate">{cnaeDisplayValue}</span>
                      ) : (
                        t("seller.fields.cnaePlaceholder")
                      )}
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t("seller.fields.cnaeSearch")} />
                      <CommandList>
                        <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                        <CommandGroup>
                          {cnaeList.map((row) => {
                            const label = `${row.cnae} - ${row.cnae_activity}`;
                            return (
                              <CommandItem
                                key={row.cnae}
                                value={label}
                                onSelect={() => {
                                  setSelectedCnae(row.cnae);
                                  setSelectedCnaeActivity(row.cnae_activity);
                                  setCnaeOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    selectedCnae === row.cnae ? "opacity-100" : "opacity-0"
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
              </div>
            )}

            <FormField
              control={form.control}
              name="business_website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("seller.fields.businessWebsite")}</FormLabel>
                  <FormControl><Input placeholder="http://seusite.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
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
