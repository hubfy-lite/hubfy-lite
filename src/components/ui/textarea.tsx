import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Textarea Component - shadcn/ui (adapted for Tailwind v3)
 *
 * Based on shadcn/ui new-york-v4 but compatible with Tailwind CSS v3
 *
 * Design System Notes:
 * - Min height: 80px
 * - Border radius: 12px (rounded-xl)
 * - Background: bg-transparent, dark:bg-input/30 (OKLCH)
 * - Border: 1px solid --input
 * - aria-invalid styling for form validation
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-xl border border-input bg-transparent dark:bg-input/30 px-4 py-3 text-base text-foreground shadow-sm transition-colors sm:text-sm",
        "placeholder:text-muted-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
