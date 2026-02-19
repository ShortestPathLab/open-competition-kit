import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "*/lib/utils";

export interface Tab {
  label: string;
  href: string;
  badge?: string | number;
}

interface TabNavProps {
  tabs: Tab[];
}

export function TabNav({ tabs }: TabNavProps) {
  const { pathname } = useLocation();

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent -mb-px",
              isActive && "border-primary text-foreground font-medium",
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
