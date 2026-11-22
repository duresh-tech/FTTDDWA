"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { BadgeCheck, Building2, Contact, Factory, Globe, KeyRound, Landmark, LayoutDashboard, LayoutList, Mail, Map, MapPin, Milestone, Network, Route, Settings2, ShieldCheck, SlidersHorizontal, UserCog, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  /** Groups items under a section header. Items without one render ungrouped at the top. */
  section?: string;
}

/**
 * ORDER IS THE GROUPING. Section headers are derived by run length further
 * down (`item.section !== items[index - 1]?.section`), not from a nested
 * structure, so items sharing a section MUST stay adjacent - interleaving two
 * sections emits the same header twice. Keeping it flat is deliberate: the
 * permission filter stays a single `.filter`, and `command-palette.tsx` and
 * `nav-breadcrumb.tsx` both consume this array as a flat list.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/system/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view", section: "Main" },

  // Who can get in, and what they may do once in.
  { href: "/system/dashboard/users", label: "System Users", icon: Users, permission: "system-users:read", section: "Access Control" },
  { href: "/system/dashboard/tenant-users", label: "Tenant Users", icon: UserCog, permission: "tenant-users:read", section: "Access Control" },
  { href: "/system/dashboard/roles", label: "Roles", icon: ShieldCheck, permission: "roles:read", section: "Access Control" },
  { href: "/system/dashboard/permissions", label: "Permissions", icon: KeyRound, permission: "permissions:read", section: "Access Control" },

  // The businesses themselves, and the records that hang off one.
  { href: "/system/dashboard/tenant-members", label: "Members", icon: Contact, permission: "tenant-members:list", section: "Tenants" },
  { href: "/system/dashboard/tenant-business", label: "Tenant Business", icon: Building2, permission: "tenant-business:list", section: "Tenants" },
  { href: "/system/dashboard/tenant-business-domains", label: "Business Domains", icon: Globe, permission: "tenant-business-domains:list", section: "Tenants" },
  { href: "/system/dashboard/tenant-mapped-business", label: "Tenant Mapped Business", icon: Network, permission: "tenant-mapped-business:list", section: "Tenants" },
  { href: "/system/dashboard/tenant-association-positions", label: "Association Positions", icon: BadgeCheck, permission: "tenant-association-positions:list", section: "Tenants" },
  { href: "/system/dashboard/tenant-industries", label: "Industries", icon: Factory, permission: "tenant-industries:list", section: "Tenants" },

  { href: "/system/dashboard/tenant-states", label: "States", icon: Map, permission: "tenant-states:list", section: "Locations" },
  { href: "/system/dashboard/tenant-districts", label: "Districts", icon: Landmark, permission: "tenant-districts:list", section: "Locations" },
  { href: "/system/dashboard/tenant-taluks", label: "Taluks", icon: Milestone, permission: "tenant-taluks:list", section: "Locations" },
  { href: "/system/dashboard/tenant-places", label: "Places", icon: MapPin, permission: "tenant-places:list", section: "Locations" },
  { href: "/system/dashboard/tenant-streets", label: "Streets", icon: Route, permission: "tenant-streets:list", section: "Locations" },

  // Machine-facing surfaces: credentials and outbound mail.
  { href: "/system/dashboard/api-keys", label: "API Keys", icon: KeyRound, permission: "api-keys:list", section: "Integrations" },
  { href: "/system/dashboard/api-key-scope-templates", label: "API Key Scope Templates", icon: LayoutList, permission: "api-key-scope-templates:list", section: "Integrations" },
  { href: "/system/dashboard/tenant-mail-config", label: "Mail Config", icon: Mail, permission: "tenant-mail-config:list", section: "Integrations" },

  { href: "/system/dashboard/app-settings", label: "App Settings", icon: SlidersHorizontal, permission: "app-settings:view", section: "Settings" },
  { href: "/system/dashboard/setting-definitions", label: "Setting Definitions", icon: Settings2, permission: "setting-definitions:list", section: "Settings" },
  { href: "/system/dashboard/tenant-business-settings", label: "Business Settings", icon: SlidersHorizontal, permission: "tenant-business-settings:list", section: "Settings" },
];

interface SidebarNavProps {
  onNavigate?: () => void;
  hasPermission?: (permissionKey: string) => boolean;
  instanceId?: string;
  navItems?: NavItem[];
  rootHref?: string;
  /** Icon-only rail - labels and section headers collapse away. */
  collapsed?: boolean;
  /** "horizontal" renders the mobile strip: one sideways-scrolling row. */
  orientation?: "vertical" | "horizontal";
}

export function SidebarNav({
  onNavigate,
  hasPermission,
  instanceId = "default",
  navItems = NAV_ITEMS,
  rootHref = "/system/dashboard",
  collapsed = false,
  orientation = "vertical",
}: SidebarNavProps) {
  const pathname = usePathname();
  const horizontal = orientation === "horizontal";
  const items = hasPermission
    ? navItems.filter((item) => hasPermission(item.permission))
    : navItems;

  // In the strip the active item can sit off-screen, so pull it into view.
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    if (!horizontal) return;
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [horizontal, pathname]);

  return (
    <nav
      className={cn(
        horizontal
          ? // `scrollbar-none` keeps the strip clean; it stays swipeable/trackpad-scrollable.
            "flex items-center gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "grid gap-1 px-2",
      )}
    >
      {items.map((item, index) => {
        const active =
          item.href === rootHref
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const sectionChanged = item.section && item.section !== items[index - 1]?.section;
        return (
          <React.Fragment key={item.href}>
            {sectionChanged && !horizontal && !collapsed && (
              <div className="mt-4 mb-1 px-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
                {item.section}
              </div>
            )}
            {/* Collapsed has no room for the header, so keep the grouping as a rule. */}
            {sectionChanged && !horizontal && collapsed && index > 0 && (
              <div className="mx-3 my-2 border-t border-white/10" />
            )}
            <Link
              ref={active ? activeRef : undefined}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                horizontal ? "shrink-0 gap-2 px-3" : "gap-3 px-3",
                collapsed && !horizontal && "justify-center px-0",
                active
                  ? "text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`active-nav-pill-${instanceId}`}
                  className={cn(
                    "absolute inset-0 rounded-lg bg-[var(--sidebar-active-bg)]",
                    !horizontal && "border-l-2 border-[var(--sidebar-active-border)]",
                    horizontal && "border-b-2 border-[var(--sidebar-active-border)]",
                  )}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <item.icon className="relative z-10 size-4 shrink-0" />
              {!(collapsed && !horizontal) && (
                <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              )}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
