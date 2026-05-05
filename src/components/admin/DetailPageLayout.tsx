import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * DetailPageLayout — Reusable layout pattern for object detail/edit pages.
 *
 * Inspired by settings page design:
 * - Tabs at top
 * - Each tab has sections with title+description on the LEFT, content on the RIGHT
 * - Danger zone as a special card section
 *
 * Usage:
 *   <DetailSection title="..." description="...">
 *     <ReadOnlyField ... />
 *     <ReadOnlyField ... />
 *     <DetailSectionFooter>
 *       <Button>Save</Button>
 *     </DetailSectionFooter>
 *   </DetailSection>
 *
 *   <DangerSection title="..." description="...">
 *     <DangerAction title="..." description="..." actionLabel="Delete" onClick={...} />
 *   </DangerSection>
 */

/* ─── Section (title+desc left | content right) ─── */

interface DetailSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function DetailSection({
  title,
  description,
  children,
  className,
}: DetailSectionProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-8 lg:flex-row lg:gap-16",
        className,
      )}
    >
      {/* Left — sticky label */}
      <div className="shrink-0 lg:w-[280px]">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Right — content */}
      <div className="flex-1 min-w-0 space-y-5">{children}</div>
    </div>
  );
}

/* ─── Section Footer (for save buttons) ─── */

interface DetailSectionFooterProps {
  children: ReactNode;
  className?: string;
}

export function DetailSectionFooter({
  children,
  className,
}: DetailSectionFooterProps) {
  return (
    <div className={cn("flex justify-end pt-2", className)}>{children}</div>
  );
}

/* ─── Danger Zone Section ─── */

interface DangerSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function DangerSection({
  title,
  description,
  children,
  className,
}: DangerSectionProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pt-2 lg:flex-row lg:gap-16",
        className,
      )}
    >
      {/* Left — label */}
      <div className="shrink-0 lg:w-[280px]">
        <h3 className="text-sm font-semibold text-destructive">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Right — danger card */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* ─── Danger Action Card ─── */

interface DangerActionProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function DangerAction({
  title,
  description,
  children,
  className,
}: DangerActionProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
