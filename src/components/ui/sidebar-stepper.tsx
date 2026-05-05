import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperSection {
  id: string;
  label: string;
  steps: StepperStep[];
}

interface SidebarStepperProps {
  /** Sections with their sub-steps */
  sections: StepperSection[];
  /** Current active step id */
  currentStep: string;
  /** Ordered list of all step ids (flat) — used to compute display order */
  stepsOrder: string[];
  /** Set of step ids that are actually complete (validated). If not provided, falls back to position-based logic. */
  completedSteps?: Set<string>;
  /** Called when user clicks a step */
  onStepClick?: (stepId: string) => void;
  className?: string;
}

/* ─── Helpers ─── */

type StepState = "completed" | "current" | "pending";

function getStepState(
  stepId: string,
  currentStep: string,
  stepsOrder: string[],
  completedSteps?: Set<string>
): StepState {
  if (stepId === currentStep) return "current";
  if (completedSteps) {
    return completedSteps.has(stepId) ? "completed" : "pending";
  }
  // Fallback: position-based
  const currentIndex = stepsOrder.indexOf(currentStep);
  const stepIndex = stepsOrder.indexOf(stepId);
  if (stepIndex < currentIndex) return "completed";
  return "pending";
}

function getSectionState(
  section: StepperSection,
  currentStep: string,
  stepsOrder: string[],
  completedSteps?: Set<string>
): StepState {
  if (section.steps.length === 0) {
    return getStepState(section.id, currentStep, stepsOrder, completedSteps);
  }
  const states = section.steps.map((s) =>
    getStepState(s.id, currentStep, stepsOrder, completedSteps)
  );
  if (states.every((s) => s === "completed")) return "completed";
  if (states.some((s) => s === "current")) return "current";
  if (states.some((s) => s === "completed")) return "current"; // partial section
  return "pending";
}

/** Get the global 1-based number for a step across all sections */
function getGlobalStepNumber(
  stepId: string,
  sections: StepperSection[]
): number {
  let count = 0;
  for (const section of sections) {
    if (section.steps.length === 0) {
      count++;
      if (section.id === stepId) return count;
    } else {
      for (const step of section.steps) {
        count++;
        if (step.id === stepId) return count;
      }
    }
  }
  return count;
}

/* ─── Component ─── */

export function SidebarStepper({
  sections,
  currentStep,
  stepsOrder,
  completedSteps,
  onStepClick,
  className,
}: SidebarStepperProps) {
  return (
    <nav className={cn("flex flex-col gap-5", className)}>
      {sections.map((section, sectionIndex) => {
        const sectionState = getSectionState(section, currentStep, stepsOrder, completedSteps);

        return (
          <div key={section.id}>
            {/* Section label */}
            <span
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider",
                sectionState === "pending"
                  ? "text-muted-foreground/70"
                  : "text-muted-foreground"
              )}
            >
              {section.label}
            </span>

            {/* Sub-steps with numbered circles */}
            {section.steps.length > 0 && (
              <div className="mt-2 flex flex-col">
                {section.steps.map((step, stepIndex) => {
                  const state = getStepState(step.id, currentStep, stepsOrder, completedSteps);
                  const isClickable = !!onStepClick && state !== "current";
                  const stepNumber = getGlobalStepNumber(step.id, sections);
                  const isLast = stepIndex === section.steps.length - 1 &&
                    sectionIndex === sections.length - 1;

                  return (
                    <div key={step.id} className="flex items-start gap-2.5">
                      {/* Circle + connector line */}
                      <div className="flex flex-col items-center">
                        <StepCircle state={state} number={stepNumber} />
                        {!isLast && (
                          <div
                            className={cn(
                              "w-px flex-1 min-h-4",
                              state === "completed"
                                ? "bg-success-border/50"
                                : "bg-border"
                            )}
                          />
                        )}
                      </div>

                      {/* Step label */}
                      <button
                        type="button"
                        disabled={!isClickable}
                        onClick={() => isClickable && onStepClick?.(step.id)}
                        className={cn(
                          "text-sm leading-6 text-left transition-colors pb-0.5",
                          state === "current" && "text-foreground font-medium",
                          state === "completed" &&
                            "text-muted-foreground cursor-pointer hover:text-foreground",
                          state === "pending" &&
                            "text-muted-foreground/70 cursor-pointer hover:text-muted-foreground",
                          !isClickable && "cursor-default"
                        )}
                      >
                        {step.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section without sub-steps (e.g. "Review") rendered as single numbered circle */}
            {section.steps.length === 0 && (
              <div className="mt-2 flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  <StepCircle
                    state={sectionState}
                    number={getGlobalStepNumber(section.id, sections)}
                  />
                </div>
                <button
                  type="button"
                  disabled={sectionState === "current" || !onStepClick}
                  onClick={() => onStepClick?.(section.id)}
                  className={cn(
                    "text-sm leading-6 text-left transition-colors",
                    sectionState === "current" && "text-foreground font-medium cursor-default",
                    sectionState === "completed" &&
                      "text-muted-foreground cursor-pointer hover:text-foreground",
                    sectionState === "pending" &&
                      "text-muted-foreground/70 cursor-pointer hover:text-muted-foreground"
                  )}
                >
                  {section.label}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* ─── Sub-components ─── */

function StepCircle({
  state,
  number,
}: {
  state: StepState;
  number: number;
}) {
  const base = "flex size-6 items-center justify-center rounded-full";

  if (state === "completed") {
    return (
      <div className={cn(base, "border border-success-border bg-success-bg")}>
        <Check className="size-3 text-success-text" strokeWidth={2.5} />
      </div>
    );
  }

  if (state === "current") {
    return (
      <div className={cn(base, "bg-primary")}>
        <span className="text-[11px] font-semibold text-primary-foreground">{number}</span>
      </div>
    );
  }

  return (
    <div className={cn(base, "bg-muted")}>
      <span className="text-[11px] font-medium text-muted-foreground/70">{number}</span>
    </div>
  );
}
