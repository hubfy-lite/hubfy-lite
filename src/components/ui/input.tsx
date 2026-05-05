import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Input Component - shadcn/ui (adapted for Tailwind v3)
 *
 * Based on shadcn/ui new-york-v4 but compatible with Tailwind CSS v3
 *
 * Design System Notes:
 * - Height: 40px (h-10)
 * - Border radius: 12px (rounded-xl)
 * - Background: bg-transparent, dark:bg-input/30 (OKLCH)
 * - Border: 1px solid --input
 * - aria-invalid styling for form validation
 */
const inputVariants = cva(
  "flex h-10 w-full rounded-xl border border-input bg-transparent dark:bg-input/30 px-4 py-2 text-base text-foreground shadow-sm transition-colors sm:text-sm",
  {
    variants: {
      variant: {
        default: "",
        readOnly:
          "bg-muted text-muted-foreground disabled:cursor-default disabled:opacity-100 cursor-default",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface InputProps
  extends React.ComponentProps<"input">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        data-variant={variant}
        className={cn(
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-[hsl(var(--placeholder-foreground))]",
          "selection:bg-primary selection:text-primary-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          inputVariants({ variant }),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
