import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Field Component - shadcn/ui (adapted for Tailwind v3)
 *
 * Based on shadcn/ui new-york-v4 but compatible with Tailwind CSS v3
 *
 * A complete field system for building accessible forms with:
 * - Labels, descriptions, and error messages
 * - Horizontal, vertical, and responsive orientations
 * - Fieldset grouping with legends
 */

// ============================================================================
// FieldSet
// ============================================================================

const FieldSet = React.forwardRef<
  HTMLFieldSetElement,
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>
>(({ className, ...props }, ref) => (
  <fieldset
    ref={ref}
    data-slot="field-set"
    className={cn("flex flex-col gap-6", className)}
    {...props}
  />
));
FieldSet.displayName = "FieldSet";

// ============================================================================
// FieldLegend
// ============================================================================

const fieldLegendVariants = cva("font-medium leading-none", {
  variants: {
    variant: {
      legend: "text-base",
      label: "text-sm",
    },
  },
  defaultVariants: {
    variant: "legend",
  },
});

export interface FieldLegendProps
  extends React.HTMLAttributes<HTMLLegendElement>,
    VariantProps<typeof fieldLegendVariants> {}

const FieldLegend = React.forwardRef<HTMLLegendElement, FieldLegendProps>(
  ({ className, variant, ...props }, ref) => (
    <legend
      ref={ref}
      data-slot="field-legend"
      data-variant={variant}
      className={cn(fieldLegendVariants({ variant, className }))}
      {...props}
    />
  )
);
FieldLegend.displayName = "FieldLegend";

// ============================================================================
// FieldGroup
// ============================================================================

const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-group"
    className={cn("@container/field-group flex flex-col gap-6", className)}
    {...props}
  />
));
FieldGroup.displayName = "FieldGroup";

// ============================================================================
// Field
// ============================================================================

const fieldVariants = cva(
  "group flex data-[disabled=true]:opacity-50",
  {
    variants: {
      orientation: {
        vertical: "flex-col gap-2",
        horizontal: "flex-row items-center justify-between gap-2",
        split: "flex-row gap-6",
        responsive:
          "flex-col gap-2 @[30rem]/field-group:flex-row @[30rem]/field-group:items-center @[30rem]/field-group:justify-between",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
);

export interface FieldProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fieldVariants> {}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation, className }))}
      {...props}
    />
  )
);
Field.displayName = "Field";

// ============================================================================
// FieldContent
// ============================================================================

const FieldContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-content"
    className={cn(
      "flex flex-1 flex-col gap-1",
      "group-data-[orientation=split]:w-1/2 group-data-[orientation=split]:gap-1.5",
      className
    )}
    {...props}
  />
));
FieldContent.displayName = "FieldContent";

// ============================================================================
// FieldControl — right-side wrapper for orientation="split"
// ============================================================================

const FieldControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-control"
    className={cn(
      "group-data-[orientation=split]:w-1/2 group-data-[orientation=split]:shrink-0",
      "group-data-[orientation=vertical]:w-full",
      className
    )}
    {...props}
  />
));
FieldControl.displayName = "FieldControl";

// ============================================================================
// FieldLabel
// ============================================================================

export interface FieldLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  asChild?: boolean;
}

const FieldLabel = React.forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "label";
    return (
      <Comp
        ref={ref}
        data-slot="field-label"
        className={cn(
          "flex items-center gap-2 text-sm font-medium leading-none text-foreground",
          "select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
FieldLabel.displayName = "FieldLabel";

// ============================================================================
// FieldTitle
// ============================================================================

const FieldTitle = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="field-title"
    className={cn("text-sm font-medium leading-none", className)}
    {...props}
  />
));
FieldTitle.displayName = "FieldTitle";

// ============================================================================
// FieldDescription
// ============================================================================

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="field-description"
    className={cn(
      "text-sm text-muted-foreground text-pretty",
      "group-data-[orientation=horizontal]:text-balance",
      "group-data-[orientation=split]:max-w-[370px]",
      className
    )}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

// ============================================================================
// FieldSeparator
// ============================================================================

const FieldSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-separator"
    className={cn(
      "flex items-center gap-4 text-xs text-muted-foreground",
      className
    )}
    {...props}
  >
    <div className="h-px flex-1 bg-border" />
    {children && <span className="shrink-0">{children}</span>}
    <div className="h-px flex-1 bg-border" />
  </div>
));
FieldSeparator.displayName = "FieldSeparator";

// ============================================================================
// FieldError
// ============================================================================

export interface FieldErrorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  errors?: Array<{ message?: string } | undefined>;
}

const FieldError = React.forwardRef<HTMLDivElement, FieldErrorProps>(
  ({ className, errors, children, ...props }, ref) => {
    const messages = errors
      ?.filter((e): e is { message: string } => Boolean(e?.message))
      .map((e) => e.message);

    if (!messages?.length && !children) return null;

    return (
      <div
        ref={ref}
        data-slot="field-error"
        role="alert"
        aria-live="polite"
        className={cn("text-sm font-medium text-destructive", className)}
        {...props}
      >
        {children}
        {messages && messages.length === 1 && <span>{messages[0]}</span>}
        {messages && messages.length > 1 && (
          <ul className="list-inside list-disc">
            {messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);
FieldError.displayName = "FieldError";

export {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
