import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Card Component - shadcn/ui (adapted for Tailwind v3)
 * 
 * Design System Notes:
 * - Border radius: 16px (rounded-2xl)
 * - Uses semantic tokens from index.css
 * - Variants: default (transparent), bordered, elevated
 * - Size: default (gap-6, p-6) and sm (gap-4, p-4)
 * - Slots use first:/last: pseudo-classes for vertical padding
 */
const cardVariants = cva(
  "flex flex-col rounded-2xl text-card-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        bordered: "bg-card ring-1 ring-foreground/10",
        elevated: "bg-card ring-1 ring-foreground/10 shadow-sm",
      },
      size: {
        default: "gap-6",
        sm: "gap-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      data-variant={variant}
      data-size={size}
      className={cn(cardVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn(
      "grid auto-rows-min grid-rows-[auto_auto] items-start gap-2",
      // Horizontal padding based on card size
      "px-6 [[data-size=sm]_&]:px-4",
      // Vertical padding: pt when first child, pb when last child
      "first:pt-6 last:pb-6 [[data-size=sm]_&]:first:pt-4 [[data-size=sm]_&]:last:pb-4",
      // When CardAction is present, use 2-column layout
      "has-[[data-slot=card-action]]:grid-cols-[1fr_auto]",
      className
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-title"
    className={cn("text-lg font-semibold leading-none", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardAction = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-action"
    className={cn(
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
      className
    )}
    {...props}
  />
));
CardAction.displayName = "CardAction";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn(
      // Horizontal padding based on card size
      "px-6 [[data-size=sm]_&]:px-4",
      // Vertical padding: pt when first child, pb when last child
      "first:pt-6 last:pb-6 [[data-size=sm]_&]:first:pt-4 [[data-size=sm]_&]:last:pb-4",
      className
    )}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn(
      "flex items-center",
      // Horizontal padding based on card size
      "px-6 [[data-size=sm]_&]:px-4",
      // Vertical padding: pt when first child, pb when last child
      "first:pt-6 last:pb-6 [[data-size=sm]_&]:first:pt-4 [[data-size=sm]_&]:last:pb-4",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
};
