import { cn } from "*/lib/utils";
import { Link, useMatchRoute, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import Avatar from "boring-avatars";
import { authClient } from "@/lib/auth-client";
import { getAuthConfig } from "src/lib/get-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/competitions", label: "Competitions" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/about", label: "About" },
];

interface NavbarProps {
  variant?: "public" | "admin";
  appName?: string;
}

export function Navbar({ variant = "public", appName = "GPPC" }: NavbarProps) {
  const match = useMatchRoute();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const fetchAuthConfig = useServerFn(getAuthConfig);
  const { data: authConfig } = useQuery({
    queryKey: ["authConfig"],
    queryFn: () => fetchAuthConfig(),
  });

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.navigate({ to: "/" });
        },
      },
    });
  };

  const isLoggedIn = !!session?.user;
  const emailEnabled = authConfig?.emailEnabled ?? false;

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3 h-14 [view-transition-name:header]">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <div className="h-8 w-8 rounded-full bg-muted">
            <Avatar name={appName} width="100%" height="100%" />
          </div>
          <span>{appName}</span>
        </Link>
        <nav className="flex items-center gap-4">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "text-sm text-muted-foreground hover:text-foreground transition-colors",
                match({ to: link.href, fuzzy: true }) &&
                  "text-primary font-medium",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {sessionLoading ? null : isLoggedIn ? (
          <>
            {variant === "admin" && (
              <button className="p-2 text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
              </button>
            )}
            <div className="h-8 w-8 rounded-full bg-muted overflow-hidden">
              <Link to="/me">
                <Avatar
                  name={session.user.name ?? session.user.email}
                  width="100%"
                  height="100%"
                />
              </Link>
            </div>
            {variant === "admin" && (
              <Link
                to="/dashboard"
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                Dashboard
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            {variant === "admin" && (
              <Link
                to="/dashboard"
                className="rounded-md border border-border px-4 py-1.5 text-sm"
              >
                Sudo
              </Link>
            )}
            {emailEnabled && (
              <Link
                to="/register"
                className="rounded-md border border-border px-4 py-1.5 text-sm"
              >
                Register
              </Link>
            )}
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
