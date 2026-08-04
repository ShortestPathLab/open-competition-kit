import { cn } from "@/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import Avatar from "boring-avatars";

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/competitions", label: "Competitions" },
  { href: "/about", label: "About" },
];

export function Brand({ appName }: { appName: string }) {
  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2 font-semibold text-lg"
    >
      <div className="h-6 w-6 shrink-0 rounded-full bg-muted">
        <Avatar name={appName} width="100%" height="100%" />
      </div>
      <span className="truncate">{appName}</span>
    </Link>
  );
}

/**
 * The same three destinations in both bars.
 *
 * They differ only in how a hit is drawn: the desktop row marks the current
 * page with colour alone, while the menu has room to fill the whole row.
 */
export function NavLinks({ variant }: { variant: "desktop" | "mobile" }) {
  const match = useMatchRoute();

  const links = PUBLIC_LINKS.map((link) => (
    <Link
      key={link.href}
      to={link.href}
      className={cn(
        "rounded-md text-sm text-muted-foreground transition-colors",
        variant === "desktop" ?
          "px-2 py-1 hover:text-foreground"
        : "px-3 py-2 hover:bg-muted hover:text-foreground",
        match({ to: link.href, fuzzy: true }) &&
          (variant === "desktop" ?
            "text-primary font-medium"
          : "bg-muted text-primary font-medium"),
      )}
    >
      {link.label}
    </Link>
  ));

  if (variant === "desktop") return <>{links}</>;
  return <nav className="flex flex-col gap-1">{links}</nav>;
}
