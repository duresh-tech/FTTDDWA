"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/**
 * `required` renders the red asterisk every mandatory field carries.
 *
 * An explicit prop rather than a `has-[:required]` CSS rule, because Select,
 * Combobox and the map picker are not `input:required` - a CSS-only rule
 * would mark some mandatory fields and silently miss others, which is worse
 * than marking none.
 *
 * The asterisk is aria-hidden and the control keeps its own `required` /
 * `aria-required`, so screen readers announce the requirement from the field
 * rather than reading out "star".
 */
function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { required?: boolean }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  );
}

export { Label };
