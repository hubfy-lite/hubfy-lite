import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  COUNTRY_PHONES,
  findCountryByCode,
  getDefaultCountryCode,
  type CountryPhone,
} from "@/lib/country-phones";

interface PhoneInputProps {
  /** Full phone value (digits only, e.g. "5511999999999") */
  value: string;
  /** Called with digits only (dial code + number) */
  onChange: (fullDigits: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Phone input with country code selector.
 * Stores and emits digits only (e.g. "5511999999999").
 * Default country is derived from the user's locale.
 */
export function PhoneInput({
  value,
  onChange,
  placeholder = "11999999999",
  disabled,
}: PhoneInputProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const defaultCode = getDefaultCountryCode(i18n.language);

  // Derive country + local number from stored digits
  const { country, localNumber } = useMemo(() => {
    if (!value) return { country: findCountryByCode(defaultCode)!, localNumber: "" };

    // Try to match a country by dial code (longest match first)
    const sorted = [...COUNTRY_PHONES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      const dialDigits = c.dial.replace(/\D/g, "");
      if (value.startsWith(dialDigits)) {
        return { country: c, localNumber: value.slice(dialDigits.length) };
      }
    }
    // Fallback to default
    return { country: findCountryByCode(defaultCode)!, localNumber: value };
  }, [value, defaultCode]);

  const handleCountrySelect = (c: CountryPhone) => {
    setOpen(false);
    const dialDigits = c.dial.replace(/\D/g, "");
    onChange(localNumber ? dialDigits + localNumber : "");
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    const dialDigits = country.dial.replace(/\D/g, "");
    onChange(digits ? dialDigits + digits : "");
  };

  return (
    <div className="flex">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="flex items-center gap-1 rounded-r-none border-r-0 px-2.5 shrink-0 font-normal"
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-sm text-muted-foreground">{country.dial}</span>
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("common.search")} />
            <CommandList>
              <CommandEmpty>{t("common.none")}</CommandEmpty>
              <CommandGroup>
                {COUNTRY_PHONES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.dial} ${c.code}`}
                    onSelect={() => handleCountrySelect(c)}
                  >
                    <span className="mr-2 text-base">{c.flag}</span>
                    <span className="flex-1 truncate text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.dial}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        className="rounded-l-none"
        inputMode="numeric"
        placeholder={placeholder}
        value={localNumber}
        onChange={handleNumberChange}
        disabled={disabled}
      />
    </div>
  );
}
