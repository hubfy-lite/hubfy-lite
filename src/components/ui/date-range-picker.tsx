import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Período",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  // Draft state — only committed on "OK"
  const [draft, setDraft] = React.useState<DateRange | undefined>(value);

  // Sync draft when popover opens
  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open]);

  const handleConfirm = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  const label = React.useMemo(() => {
    if (!value?.from) return null;
    if (!value.to) return format(value.from, "dd/MM/yyyy");
    return `${format(value.from, "dd/MM/yyyy")} — ${format(value.to, "dd/MM/yyyy")}`;
  }, [value]);

  const canConfirm = !!draft?.from;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-full justify-start text-left text-sm font-normal sm:w-auto md:h-10",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-3.5 shrink-0 md:size-4" />
          <span className={cn(label && "text-xs md:text-sm")}>
            {label ?? placeholder}
          </span>
          {label && (
            <span
              role="button"
              className="ml-1.5 rounded-sm p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <X className="size-3 text-muted-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={1}
          initialFocus
        />
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
          {value?.from && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleClear}
            >
              Limpar
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
