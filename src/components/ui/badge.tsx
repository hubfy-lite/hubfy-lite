import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge Component — shadcn/ui (adapted for Tailwind v3)
 *
 * 12-color palette: gray, red, orange, amber, yellow, lime, green, teal, blue, indigo, purple, pink
 * Semantic aliases: destructive → red, success → green, warning → amber, info → blue
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:pointer-events-none [&_svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground border-border",

        // ── 12-color palette ──
        gray:    "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/20",
        red:     "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
        orange:  "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
        amber:   "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
        yellow:  "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
        lime:    "bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/20",
        green:   "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
        teal:    "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/20",
        blue:    "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
        indigo:  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
        purple:  "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
        pink:    "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/20",

        // ── Semantic aliases ──
        destructive: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
        success:     "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
        warning:     "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
        info:        "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";
    return (
      <Comp
        ref={ref}
        data-slot="badge"
        data-variant={variant}
        className={cn(badgeVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
