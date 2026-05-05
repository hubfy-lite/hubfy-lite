import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save } from "lucide-react";
import { usePortal } from "@/contexts/PortalContext";
import { useUpdateCustomerProfile } from "@/hooks/useUpdateCustomerProfile";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  phone: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function PortalProfile() {
  const { t } = useTranslation();
  const { customer, tenant } = usePortal();
  const { toast } = useToast();
  const updateProfile = useUpdateCustomerProfile(tenant.id);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: customer.name || "",
      phone: customer.phone || "",
      city: customer.city || "",
      region: customer.region || "",
      country: customer.country || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync({
        name: data.name,
        phone: data.phone || undefined,
        city: data.city || undefined,
        region: data.region || undefined,
        country: data.country || undefined,
      });
      toast({
        variant: "success",
        title: t("common.success"),
        description: t("portal.profile.updateSuccess"),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.unexpectedError"),
      });
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6 px-4 pb-8 max-w-2xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("portal.profile.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("portal.profile.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("portal.profile.personalData")}</CardTitle>
            <CardDescription>{t("portal.profile.personalDataHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">{t("common.name")}</FieldLabel>
                <Input
                  id="name"
                  placeholder={t("common.name")}
                  {...form.register("name")}
                />
                <FieldError>{form.formState.errors.name?.message}</FieldError>
              </Field>

              {/* Email — somente leitura */}
              <Field>
                <FieldLabel htmlFor="email">{t("common.email")}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={customer.email}
                  disabled
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("portal.profile.emailReadOnly")}
                </p>
              </Field>

              <Field>
                <FieldLabel htmlFor="phone">{t("common.phone")}</FieldLabel>
                <Input
                  id="phone"
                  placeholder={t("portal.profile.phonePlaceholder")}
                  {...form.register("phone")}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="city">{t("portal.profile.city")}</FieldLabel>
                  <Input
                    id="city"
                    placeholder={t("portal.profile.cityPlaceholder")}
                    {...form.register("city")}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="region">{t("portal.profile.region")}</FieldLabel>
                  <Input
                    id="region"
                    placeholder={t("portal.profile.regionPlaceholder")}
                    {...form.register("region")}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="country">{t("portal.profile.country")}</FieldLabel>
                  <Input
                    id="country"
                    placeholder={t("portal.profile.countryPlaceholder")}
                    {...form.register("country")}
                  />
                </Field>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("common.saving")}
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      {t("common.save")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
