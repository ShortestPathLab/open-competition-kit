import { Link, useLocation } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { cn } from "*/lib/utils";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/competitions", label: "Competitions" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/about", label: "About" },
];

interface NavbarProps {
  variant?: "public" | "admin";
}

export function Navbar({ variant = "public" }: NavbarProps) {
  const { pathname } = useLocation();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <span>GPPC</span>
        </Link>
        <nav className="flex items-center gap-4">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "text-sm text-muted-foreground hover:text-foreground transition-colors",
                pathname === link.href && "text-primary font-medium",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {variant === "admin" ? (
          <>
            <button className="p-2 text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-muted" />
            <button className="rounded-md border border-border px-3 py-1.5 text-sm">
              Sudo
            </button>
            <Link
              to="/dashboard"
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              Dashboard
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/register"
              className="rounded-md border border-border px-4 py-1.5 text-sm"
            >
              Register
            </Link>
            <Link
              to="/sign-in"
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground"
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
