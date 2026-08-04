"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToggleTabsProps {
  tabs: string[];
  defaultTab?: string;
  onChange?: (tab: string) => void;
}

export function ToggleTabs({ tabs, defaultTab, onChange }: ToggleTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]);

  return (
    <div className="inline-flex rounded-md border border-border">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => {
            setActive(tab);
            onChange?.(tab);
          }}
          className={cn(
            "px-3 py-1.5 text-sm transition-colors",
            active === tab
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
