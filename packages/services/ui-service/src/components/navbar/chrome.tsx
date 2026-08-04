import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";

type ChromeProps = {
  brand: ReactNode;
  navLinks: ReactNode;
  actions: ReactNode;
  /**
   * Whether the reader is inside a competition that carries a banner. The bar
   * then drops its own fill and border and paints the top slice of the shell's
   * image instead, so that it and the header band below it read as one surface.
   */
  banner?: boolean;
};

const barClass = (banner: boolean | undefined, extra: string) =>
  cn(
    "h-14 items-center justify-between py-3 [view-transition-name:header]",
    banner ? "banner-chrome" : "bg-card border-b border-border",
    extra,
  );

export function DesktopNavbar({
  brand,
  navLinks,
  actions,
  banner,
}: ChromeProps) {
  return (
    <header className={barClass(banner, "hidden px-6 md:flex")}>
      <div className="flex min-w-0 items-center gap-6">
        {brand}
        <nav className="flex items-center gap-4">{navLinks}</nav>
      </div>
      <div className="flex items-center gap-3">{actions}</div>
    </header>
  );
}

export function MobileNavbar({ brand, navLinks, actions, banner }: ChromeProps) {
  return (
    <header className={barClass(banner, "flex px-4 md:hidden")}>
      {brand}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open navigation menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="flex flex-col gap-1 p-1">
              <div className="border-b border-border pb-2">{navLinks}</div>
              <div className="pt-2">{actions}</div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
