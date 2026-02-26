import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "*/lib/utils";

export interface Tab {
  label: string;
  href: string;
  badge?: string | number;
}

interface TabNavProps {
  tabs: Tab[];
  variant?: "underline" | "pill";
}

export function TabNav({ tabs, variant = "pill" }: TabNavProps) {
  const { pathname } = useLocation();

  return (
    <nav className="flex items-center gap-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              "flex items-center  gap-1.5 px-3 py-2 text-sm text-muted-foreground transition-colors",
              variant === "underline" &&
                "border-b-2 hover:text-foreground border-transparent",
              variant === "pill" && "rounded-md hover:text-primary ",
              variant === "pill" &&
                isActive &&
                "bg-primary/10 text-primary font-medium",
              variant === "underline" &&
                isActive &&
                "border-primary text-primary font-medium",
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
