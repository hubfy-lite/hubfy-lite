import { cn } from "@/lib/utils";
import { WORKSPACE_COLORS } from "@/lib/workspace-icons";

interface ColorPaletteProps {
  value: string | null | undefined;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export default function ColorPalette({ value, onChange, disabled }: ColorPaletteProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 p-0.5", disabled && "opacity-50 pointer-events-none")}>
      {WORKSPACE_COLORS.map((color) => {
        const isSelected = value?.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            disabled={disabled}
            className={cn(
              "size-8 rounded-full transition-all flex items-center justify-center border border-black/10 dark:border-white/10",
              isSelected
                ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                : "hover:scale-110",
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        );
      })}
    </div>
  );
}
