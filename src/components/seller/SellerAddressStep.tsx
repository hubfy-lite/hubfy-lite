import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { Seller } from "@/types/seller";

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const addressBlockSchema = z.object({
  line1: z.string().min(1, "Obrigatório"),
  line2: z.string().min(1, "Obrigatório"),
  line3: z.string().optional().default(""),
  neighborhood: z.string().min(1, "Obrigatório"),
  city: z.string().min(1, "Obrigatório"),
  state: z.string().length(2, "UF inválida").refine((v) => BRAZILIAN_STATES.includes(v.toUpperCase()), "UF inválida"),
  postal_code: z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos"),
  country_code: z.string().default("BR"),
});

// PF: 1 endereço. PJ: 2 endereços (pessoal + empresa)
const individualSchema = z.object({ address: addressBlockSchema });
const businessSchema = z.object({
  address: addressBlockSchema,
  business_address: addressBlockSchema,
});

interface SellerAddressStepProps {
  seller: Seller;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

function AddressFields({ prefix, form }: { prefix: "address" | "business_address"; form: any }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Rua (80%) / Número (20%) */}
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

      {/* Complemento (50%) / Bairro (50%) */}
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

      {/* Cidade (50%) / Estado (20%) / CEP (30%) */}
      <div className="grid grid-cols-[1fr_80px_120px] gap-4">
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
        <FormField
          control={form.control}
          name={`${prefix}.postal_code`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller.fields.postalCode")}</FormLabel>
              <FormControl><Input placeholder="01001000" maxLength={8} {...field} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

export function SellerAddressStep({ seller, onSave, onNext, onBack }: SellerAddressStepProps) {
  const { t } = useTranslation();
  const isBusiness = seller.type === "business";

  const schema = isBusiness ? businessSchema : individualSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      address: {
        line1: seller.address_line1 ?? "",
        line2: seller.address_line2 ?? "",
        line3: seller.address_line3 ?? "",
        neighborhood: seller.address_neighborhood ?? "",
        city: seller.address_city ?? "",
        state: seller.address_state ?? "",
        postal_code: seller.address_postal_code ?? "",
        country_code: seller.address_country_code ?? "BR",
      },
      ...(isBusiness
        ? {
            business_address: {
              line1: seller.business_address_line1 ?? "",
              line2: seller.business_address_line2 ?? "",
              line3: seller.business_address_line3 ?? "",
              neighborhood: seller.business_address_neighborhood ?? "",
              city: seller.business_address_city ?? "",
              state: seller.business_address_state ?? "",
              postal_code: seller.business_address_postal_code ?? "",
              country_code: seller.business_address_country_code ?? "BR",
            },
          }
        : {}),
    },
  });

  const handleSubmit = async (data: any) => {
    const flat: Record<string, unknown> = {
      address_line1: data.address.line1,
      address_line2: data.address.line2,
      address_line3: data.address.line3 || null,
      address_neighborhood: data.address.neighborhood,
      address_city: data.address.city,
      address_state: data.address.state.toUpperCase(),
      address_postal_code: data.address.postal_code,
      address_country_code: data.address.country_code,
    };

    if (isBusiness && data.business_address) {
      flat.business_address_line1 = data.business_address.line1;
      flat.business_address_line2 = data.business_address.line2;
      flat.business_address_line3 = data.business_address.line3 || null;
      flat.business_address_neighborhood = data.business_address.neighborhood;
      flat.business_address_city = data.business_address.city;
      flat.business_address_state = data.business_address.state.toUpperCase();
      flat.business_address_postal_code = data.business_address.postal_code;
      flat.business_address_country_code = data.business_address.country_code;
    }

    await onSave(flat);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-normal text-foreground md:text-xl">{t("seller.steps.address.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("seller.steps.address.description")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Endereço pessoal */}
          <div className="space-y-3">
            <h4 className="text-label font-medium">
              {isBusiness ? t("seller.steps.address.ownerAddress") : t("seller.steps.address.personalAddress")}
            </h4>
            <AddressFields prefix="address" form={form} />
          </div>

          {/* Endereço empresa (PJ) */}
          {isBusiness && (
            <div className="space-y-3 border-t pt-6">
              <h4 className="text-label font-medium">{t("seller.steps.address.businessAddress")}</h4>
              <AddressFields prefix="business_address" form={form} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              {t("common.back")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("common.saving") : t("common.next")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
