import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileStepperProps {
  /** Total number of steps */
  totalSteps: number;
  /** Current step index (0-based) */
  currentStep: number;
  className?: string;
}

export function MobileStepper({
  totalSteps,
  currentStep,
  className,
}: MobileStepperProps) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i <= currentStep ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
