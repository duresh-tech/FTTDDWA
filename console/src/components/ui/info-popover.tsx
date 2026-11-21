"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * The longer explanation behind a label, on a small (i) beside it.
 *
 * Built on Popover rather than a hover tooltip on purpose: a tooltip that only
 * opens on hover is unreachable on a touch screen, and this carries the text
 * that decides what a setting does. It opens on click, tap and keyboard focus
 * alike.
 *
 * It is the *secondary* explanation. The setting's own description paragraph
 * stays on screen and says the essential thing; this carries the detail that
 * would bloat it.
 */
export function InfoPopover({
  children,
  label = "More about this setting",
  className,
}: {
  children: React.ReactNode;
  /** Announced to a screen reader, since the trigger is only an icon. */
  label?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          // Inside a settings form, so never a submit button.
          type="button"
          aria-label={label}
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-hidden focus-visible:ring-2",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
