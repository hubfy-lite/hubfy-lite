import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button Component - shadcn/ui (adapted for Tailwind v3)
 * 
 * Based on shadcn/ui new-york-v4 but compatible with Tailwind CSS v3
 * 
 * Design System Notes:
 * - Height: 40px (h-10) for default size
 * - Border radius: 12px (rounded-xl)
 * - Uses semantic tokens from index.css
 * - Outline variant: subtle border with foreground/10
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all border border-transparent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-border bg-[hsl(0_0%_100%)] shadow-sm hover:bg-[hsl(0_0%_96%)] dark:bg-[hsl(0_0%_12%)] dark:hover:bg-[hsl(0_0%_20%)]",
        secondary:
          "bg-foreground text-background hover:bg-foreground/90",
        ghost:
          "hover:bg-muted hover:text-foreground",
        tertiary:
          "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
        highlight:
          "bg-highlight text-highlight-foreground hover:bg-highlight/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px] py-[10px]",
        xs: "h-7 gap-1 px-2 text-xs",
        sm: "h-9 gap-1.5 px-3",
        lg: "h-11 px-6",
        icon: "size-10",
        "icon-xs": "size-7",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
      pill: {
        true: "rounded-full",
        false: "",
      },
    },
    compoundVariants: [
      // Default shape (non-pill) border radius per size
      { pill: false, size: "default", className: "rounded-xl" },
      { pill: false, size: "xs", className: "rounded-lg" },
      { pill: false, size: "sm", className: "rounded-lg" },
      { pill: false, size: "lg", className: "rounded-xl" },
      { pill: false, size: "icon", className: "rounded-xl" },
      { pill: false, size: "icon-xs", className: "rounded-lg" },
      { pill: false, size: "icon-sm", className: "rounded-lg" },
      { pill: false, size: "icon-lg", className: "rounded-xl" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      pill: true,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, pill, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
