"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { BadgeCheck, Building2, Factory, KeyRound, Landmark, Mail, Map, MapPin, Milestone, Route, Settings2, User } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantSession } from "@/hooks/use-tenant-session";

/**
 * ORDER IS THE GROUPING, as in `sidebar-nav.tsx`: headers come from run length
 * over this flat array, so items sharing a section must stay adjacent or the
 * same header renders twice.
 */
const SETTINGS_NAV_ITEMS = [
  { href: "/tenant/settings/user-account", label: "Account Settings", icon: User, permission: "tenant-account:view", section: "Account" },

  { href: "/tenant/settings/business-information", label: "Business Information", icon: Building2, permission: "tenant-business:view", section: "Business" },
  { href: "/tenant/settings/business-settings", label: "Business Settings", icon: Settings2, permission: "tenant-business-settings:view", section: "Business" },
  { href: "/tenant/settings/mail-config", label: "Mail Config", icon: Mail, permission: "tenant-mail-config:list", section: "Business" },
  { href: "/tenant/settings/association-positions", label: "Association Positions", icon: BadgeCheck, permission: "tenant-association-positions:list", section: "Business" },
  { href: "/tenant/settings/industries", label: "Industries", icon: Factory, permission: "tenant-industries:list", section: "Business" },

  { href: "/tenant/settings/states", label: "States", icon: Map, permission: "tenant-states:list", section: "Locations" },
  { href: "/tenant/settings/districts", label: "Districts", icon: Landmark, permission: "tenant-districts:list", section: "Locations" },
  { href: "/tenant/settings/taluks", label: "Taluks", icon: Milestone, permission: "tenant-taluks:list", section: "Locations" },
  { href: "/tenant/settings/places", label: "Places", icon: MapPin, permission: "tenant-places:list", section: "Locations" },
  { href: "/tenant/settings/streets", label: "Streets", icon: Route, permission: "tenant-streets:list", section: "Locations" },

  { href: "/tenant/settings/api-keys", label: "API Keys", icon: KeyRound, permission: "api-keys:list", section: "Developer" },
];

export function TenantSettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission } = useTenantSession();
  const items = SETTINGS_NAV_ITEMS.filter((item) => hasPermission(item.permission));
  const active = items.find((item) => pathname.startsWith(item.href));

  // Grouped after filtering, so a section whose every item is hidden by
  // permissions never renders an empty header. Built once and shared by the
  // mobile <Select> and the desktop rail.
  const sections = items.reduce<
    { section: string; items: typeof items }[]
  >((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else acc.push({ section: item.section, items: [item] });
    return acc;
  }, []);

  return (
    <div className="w-full shrink-0 md:w-64">
      {/* Mobile: dropdown */}
      <div className="md:hidden">
        <Select value={active?.href} onValueChange={(href) => router.push(href)}>
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="Settings" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((group) => (
              <SelectGroup key={group.section}>
                <SelectLabel>{group.section}</SelectLabel>
                {group.items.map((item) => (
                  <SelectItem key={item.href} value={item.href}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: vertical list */}
      <nav className="hidden rounded-xl border bg-card p-2 md:grid md:gap-1">
        {sections.map((group, groupIndex) => (
          <div key={group.section} className="grid gap-1">
            <p
              className={cn(
                "px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                groupIndex > 0 && "mt-2 border-t pt-3",
              )}
            >
              {group.section}
            </p>
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
