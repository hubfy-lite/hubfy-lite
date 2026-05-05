import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Tabs Component — shadcn/ui pattern (adapted for Tailwind v3)
 *
 * Follows the official shadcn/ui component structure with group-data selectors.
 * Tailwind v4 uses `group-data-horizontal/tabs`; we use `group-data-[orientation=horizontal]/tabs`.
 *
 * Supports:
 * - "default" (pill) and "line" variants
 * - Horizontal (default) and vertical orientation
 */

/* ── Root ── */

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    data-slot="tabs"
    orientation={orientation}
    data-orientation={orientation}
    className={cn(
      "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
      className
    )}
    {...props}
  />
));
Tabs.displayName = TabsPrimitive.Root.displayName;

/* ── List ── */

const tabsListVariants = cva(
  "group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=horizontal]/tabs:h-8 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "gap-1.5",
        line: "gap-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-slot="tabs-list"
    data-variant={variant}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/* ── Trigger ── */

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-slot="tabs-trigger"
    className={cn(
      // Base
      "gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center justify-center",
      // Icons
      "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      // States
      "disabled:pointer-events-none disabled:opacity-50",
      // Colors — only font color changes on hover/active
      "text-muted-foreground hover:text-foreground data-[state=active]:text-foreground",
      // Line variant — active underline indicator
      "group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:mb-[-1px] group-data-[variant=line]/tabs-list:data-[state=active]:border-foreground",
      // Vertical orientation
      "group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
      // Focus
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background focus-visible:outline-none",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/* ── Content ── */

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    data-slot="tabs-content"
    className={cn("text-sm flex-1 outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
