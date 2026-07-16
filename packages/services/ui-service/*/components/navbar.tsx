import type { ReactNode } from "react";
import { cn } from "*/lib/utils";
import { Button } from "*/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "*/components/ui/dropdown-menu";
import { Link, useMatchRoute, useRouter } from "@tanstack/react-router";
import { Bell, Menu } from "lucide-react";
import Avatar from "boring-avatars";
import { authClient } from "@/lib/auth-client";
import { getAdminStatus } from "src/lib/admin";
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
  appName?: string;
}

interface DesktopNavbarProps {
  brand: ReactNode;
  navLinks: ReactNode;
  actions: ReactNode;
}

function DesktopNavbar({ brand, navLinks, actions }: DesktopNavbarProps) {
  return (
    <header className="hidden h-14 items-center justify-between border-b border-border px-6 py-3 [view-transition-name:header] md:flex">
      <div className="flex min-w-0 items-center gap-6">
        {brand}
        <nav className="flex items-center gap-4">{navLinks}</nav>
      </div>
      <div className="flex items-center gap-3">{actions}</div>
    </header>
  );
}

interface MobileNavbarProps {
  brand: ReactNode;
  navLinks: ReactNode;
  actions: ReactNode;
}

function MobileNavbar({ brand, navLinks, actions }: MobileNavbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 py-3 [view-transition-name:header] md:hidden">
      {brand}
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
    </header>
  );
}

export function Navbar({ appName = "Open Competition Kit" }: NavbarProps) {
  const match = useMatchRoute();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const fetchAuthConfig = useServerFn(getAuthConfig);
  const { data: authConfig } = useQuery({
    queryKey: ["authConfig"],
    queryFn: () => fetchAuthConfig(),
  });

  // Ask the server who is actually an admin rather than inferring it from the
  // session: the `/dashboard` guard checks the config allowlist, so anything
  // less here shows a button that only bounces the user back.
  const fetchAdminStatus = useServerFn(getAdminStatus);
  const { data: adminStatus } = useQuery({
    queryKey: ["adminStatus"],
    queryFn: () => fetchAdminStatus(),
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
  const isAdmin = adminStatus?.isAdmin ?? false;
  const emailEnabled = authConfig?.emailEnabled ?? false;
  const brand = (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2 font-semibold text-lg"
    >
      <div className="h-8 w-8 shrink-0 rounded-full bg-muted">
        <Avatar name={appName} width="100%" height="100%" />
      </div>
      <span className="truncate">{appName}</span>
    </Link>
  );

  const navLinks = publicLinks.map((link) => (
    <Link
      key={link.href}
      to={link.href}
      className={cn(
        "rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
        match({ to: link.href, fuzzy: true }) && "text-primary font-medium",
      )}
    >
      {link.label}
    </Link>
  ));

  const adminNoticeAction =
    isAdmin ? (
      <button className="p-2 text-muted-foreground transition-colors hover:text-foreground">
        <Bell className="h-5 w-5" />
        <span className="sr-only">Notifications</span>
      </button>
    ) : null;

  const profileLink = isLoggedIn ? (
    <Link to="/me" className="block">
      <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
        <Avatar
          name={session.user.name ?? session.user.email}
          width="100%"
          height="100%"
        />
      </div>
    </Link>
  ) : null;

  const dashboardAction =
    isAdmin ? (
      <Link to="/dashboard" className="block">
        <Button className="w-full">Dashboard</Button>
      </Link>
    ) : null;

  const signedInActions = (
    <>
      {adminNoticeAction}
      {profileLink}
      {dashboardAction}
      <Button onClick={handleSignOut} variant="outline">
        Sign out
      </Button>
    </>
  );

  const signedOutActions = (
    <>
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
  );

  const desktopActions = sessionLoading
    ? null
    : isLoggedIn
      ? signedInActions
      : signedOutActions;
  const mobileActions = sessionLoading ? null : (
    <div className="flex flex-col gap-2">
      {isLoggedIn ? (
        <>
          <div className="flex items-center justify-between gap-2 w-full mb-1">
            {profileLink && (
              <div className=" flex items-center gap-3 rounded-md px-2 py-1">
                {profileLink}
                <span className="min-w-0 truncate text-sm font-medium">
                  {session.user.name ?? session.user.email}
                </span>
              </div>
            )}
            {adminNoticeAction}
          </div>
          {dashboardAction}
          <Button onClick={handleSignOut} variant="outline">
            Sign out
          </Button>
        </>
      ) : (
        <>
          {emailEnabled && (
            <Link
              to="/register"
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Register
            </Link>
          )}
          <Link
            to="/sign-in"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Sign in
          </Link>
        </>
      )}
    </div>
  );

  const mobileNavLinks = (
    <nav className="flex flex-col gap-1">
      {publicLinks.map((link) => (
        <Link
          key={link.href}
          to={link.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            match({ to: link.href, fuzzy: true }) &&
              "bg-muted text-primary font-medium",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <DesktopNavbar
        brand={brand}
        navLinks={navLinks}
        actions={desktopActions}
      />
      <MobileNavbar
        brand={brand}
        navLinks={mobileNavLinks}
        actions={mobileActions}
      />
    </>
  );
}
