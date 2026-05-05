import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ChevronsUpDown, Check, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBrazilianBanks } from "@/hooks/useBrazilianBanks";
import type { Seller } from "@/types/seller";

interface SellerBankStepProps {
  seller: Seller;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onNext: () => void;
}

export function SellerBankStep({ seller, onSave, onNext }: SellerBankStepProps) {
  const { t } = useTranslation();
  const { data: banks, isLoading: banksLoading, error: banksError } = useBrazilianBanks(true);
  const [bankOpen, setBankOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    defaultValues: {
      bank_code: seller.bank_code ?? "",
      bank_agency: seller.bank_agency ?? "",
      bank_account: seller.bank_account ?? "",
      bank_account_type: seller.bank_account_type ?? "checking",
    },
  });

  const selectedBankCode = form.watch("bank_code");

  const selectedBankLabel = useMemo(() => {
    if (!selectedBankCode || !banks) return "";
    const bank = banks.find((b) => String(b.code) === selectedBankCode);
    return bank ? `${String(bank.code).padStart(3, "0")} - ${bank.name}` : selectedBankCode;
  }, [selectedBankCode, banks]);

  const handleNext = async () => {
    setSaving(true);
    try {
      const data = form.getValues();
      await onSave({
        bank_code: data.bank_code || null,
        bank_agency: data.bank_agency ? data.bank_agency.replace(/\D/g, "") : null,
        bank_account: data.bank_account || null,
        bank_account_type: data.bank_account_type,
      });
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
          {t("seller.steps.bank.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("seller.steps.bank.description")}
        </p>
      </div>

      {/* Callout */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
        <div className="flex gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {t("seller.steps.bank.callout")}
          </p>
        </div>
      </div>

      {/* País — locked to Brasil */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("seller.fields.country")}</label>
        <Input
          value="🇧🇷 Brasil"
          disabled
          className="bg-muted text-muted-foreground"
        />
      </div>

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* Bank select with search */}
          <FormField
            control={form.control}
            name="bank_code"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t("seller.fields.bank")}</FormLabel>
                <Popover open={bankOpen} onOpenChange={setBankOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={bankOpen}
                        className={cn(
                          "w-full justify-between font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {banksLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            {t("common.loading")}
                          </span>
                        ) : field.value ? (
                          <span className="truncate">{selectedBankLabel}</span>
                        ) : (
                          t("seller.fields.bankPlaceholder")
                        )}
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t("seller.fields.bankSearch")} />
                      <CommandList>
                        <CommandEmpty>
                          {banksError
                            ? t("seller.errors.banksFetchFailed")
                            : t("common.noResults")}
                        </CommandEmpty>
                        <CommandGroup>
                          {(banks ?? []).map((bank) => {
                            const code = String(bank.code);
                            const label = `${code.padStart(3, "0")} - ${bank.name}`;
                            return (
                              <CommandItem
                                key={bank.ispb}
                                value={label}
                                onSelect={() => {
                                  field.onChange(code);
                                  setBankOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    field.value === code ? "opacity-100" : "opacity-0"
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
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Account Type */}
          <FormField
            control={form.control}
            name="bank_account_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.bankAccountType")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="checking">
                      {t("seller.fields.checkingAccount")}
                    </SelectItem>
                    <SelectItem value="savings">
                      {t("seller.fields.savingsAccount")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Agency */}
          <FormField
            control={form.control}
            name="bank_agency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.bankAgency")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0001"
                    maxLength={10}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.replace(/[^0-9-]/g, ""))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Account */}
          <FormField
            control={form.control}
            name="bank_account"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller.fields.bankAccount")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="12345-6"
                    maxLength={20}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.replace(/[^0-9-]/g, ""))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
