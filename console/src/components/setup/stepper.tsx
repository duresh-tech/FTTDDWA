"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal step indicator for the first-run wizard.
 *
 * Built from existing primitives on purpose -- the shadcn `progress` and
 * `tabs` components are not installed, and a few divs are cheaper than adding
 * them for one screen.
 */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="Setup progress">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  done || active ? "bg-primary" : "bg-muted",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 truncate text-xs transition-colors",
                  active
                    ? "font-medium text-foreground"
                    : done
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                {done && <Check className="size-3 shrink-0" aria-hidden />}
                <span className="truncate">{label}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
