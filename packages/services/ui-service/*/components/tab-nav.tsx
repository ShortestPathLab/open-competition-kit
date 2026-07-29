import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "*/lib/utils";

export interface Tab {
  label: string;
  href: string;
  exact?: boolean;
  badge?: string | number;
}

interface TabNavProps {
  tabs: Tab[];
  variant?: "underline" | "pill";
}

/**
 * A tab strip, sized to its labels and aligned left.
 *
 * Tabs used to be stretched with `w-full` and centred, which spread five of
 * them across the whole page and read as a segmented control rather than as
 * navigation. Left aligned, the strip starts where every other line of the
 * header starts and stops when it runs out of tabs.
 */
export function TabNav({ tabs, variant = "pill" }: TabNavProps) {
  const { pathname } = useLocation();

  return (
    <nav
      className={cn(
        "flex items-center overflow-x-auto",
        variant === "pill" ? "gap-1" : "gap-6",
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              variant === "underline" &&
                "-mb-px border-b-2 border-transparent py-2.5",
              variant === "pill" && "rounded-md px-3 py-1.5",
              variant === "pill" && isActive && "bg-secondary text-foreground",
              variant === "underline" &&
                isActive &&
                "border-primary text-foreground",
              isActive && "font-medium",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
