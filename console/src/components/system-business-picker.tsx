"use client";

import * as React from "react";

import { Combobox } from "@/components/ui/combobox";
import { api, type ListResponse } from "@/lib/api";

interface BusinessOption {
  id: string;
  name: string;
}

/**
 * Picks one tenant business, for system pages that show one business at a
 * time. Picks the only business by itself when there is just one, so a
 * single-business instance never shows an empty screen asking the operator to
 * choose the obvious.
 */
export function SystemBusinessPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [options, setOptions] = React.useState<BusinessOption[] | null>(null);

  React.useEffect(() => {
    api<ListResponse<BusinessOption>>("/system/tenant-business?limit=100&page=1")
      .then((d) => {
        setOptions(d.items);
        if (d.items.length === 1 && !value) onChange(d.items[0].id);
      })
      .catch(() => setOptions([]));
    // Once: the list does not change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Combobox
      className={className ?? "w-72"}
      options={options?.map((b) => ({ value: b.id, label: b.name })) ?? null}
      value={value}
      onValueChange={onChange}
      placeholder="Select a business"
      searchPlaceholder="Search businesses..."
      emptyText="No businesses found."
    />
  );
}
