import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const toggle = (optionValue: string) => {
    const next = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onValueChange(next);
  };

  const selectedLabels = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label);

  const displayText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-[hsl(0_0%_96%)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-[hsl(0_0%_20%)]",
            open && "bg-[hsl(0_0%_96%)] dark:bg-[hsl(0_0%_20%)]",
            className,
          )}
        >
          <span className="truncate text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              displayText
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[180px] p-1"
      >
        <div className="max-h-[280px] overflow-y-auto">
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(option.value)}
                />
                <span className="truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
