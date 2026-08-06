import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import Avatar from "boring-avatars";
import type { NavbarState, SessionUser } from "./use-navbar";

const nameOf = (user: SessionUser) => user.name ?? user.email;

function ProfileAvatar({ user }: { user: SessionUser }) {
  return (
    <Link to="/me" className="block">
      <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
        <Avatar name={nameOf(user)} width="100%" height="100%" />
      </div>
    </Link>
  );
}

function DashboardButton() {
  return (
    <Link to="/dashboard" className="block">
      <Button className="w-full">Sudo</Button>
    </Link>
  );
}

/**
 * The organiser's way in before they have proved the address is theirs.
 *
 * Takes the slot the Sudo button would have, and does not pretend to be it. The
 * dashboard is not reachable yet and a button that says so honestly costs less
 * than one that promises the dashboard and delivers a form.
 */
function ConfirmAccountButton() {
  return (
    <Link to="/me/verify" className="block">
      <Button variant="outline" className="w-full">
        Confirm account
      </Button>
    </Link>
  );
}

/**
 * Register only when there is a password to register with. An install running
 * on OAuth alone has no form behind that link.
 */
function SignedOutActions({ emailEnabled, padding }: { emailEnabled: boolean; padding: string }) {
  return (
    <>
      {emailEnabled && (
        <Link to="/register" className={cn("rounded-md border border-border text-sm", padding)}>
          Register
        </Link>
      )}
      <Link
        to="/sign-in"
        className={cn("rounded-md bg-primary text-sm text-primary-foreground", padding)}
      >
        Sign in
      </Link>
    </>
  );
}

type ActionsProps = Pick<
  NavbarState,
  "sessionLoading" | "isLoggedIn" | "isAdmin" | "mayClaim" | "emailEnabled" | "user"
> & { onSignOut: () => void };

export function DesktopActions({
  sessionLoading,
  isLoggedIn,
  isAdmin,
  mayClaim,
  emailEnabled,
  user,
  onSignOut,
}: ActionsProps) {
  if (sessionLoading) {
    return (
      <div className="flex items-center gap-2" role="status" aria-label="Loading account">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="size-9 rounded-full" />
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return <SignedOutActions emailEnabled={emailEnabled} padding="px-4 py-1.5" />;
  }

  return (
    <>
      <ProfileAvatar user={user} />
      {isAdmin ? <DashboardButton /> : null}
      {mayClaim ? <ConfirmAccountButton /> : null}
      <Button onClick={onSignOut} variant="outline">
        Sign out
      </Button>
    </>
  );
}

export function MobileActions({
  sessionLoading,
  isLoggedIn,
  isAdmin,
  mayClaim,
  emailEnabled,
  user,
  onSignOut,
}: ActionsProps) {
  // Nothing at all while the session is in flight: the menu is closed anyway,
  // and a skeleton inside a dropdown nobody has opened is motion for its own
  // sake.
  if (sessionLoading) return null;

  return (
    <div className="flex flex-col gap-2">
      {isLoggedIn && user ? (
        <>
          <div className="flex items-center justify-between gap-2 w-full mb-1">
            <div className="flex items-center gap-3 rounded-md px-2 py-1">
              <ProfileAvatar user={user} />
              <span className="min-w-0 truncate text-sm font-medium">{nameOf(user)}</span>
            </div>
          </div>
          {isAdmin ? <DashboardButton /> : null}
          {mayClaim ? <ConfirmAccountButton /> : null}
          <Button onClick={onSignOut} variant="outline">
            Sign out
          </Button>
        </>
      ) : (
        <SignedOutActions emailEnabled={emailEnabled} padding="px-4 py-2" />
      )}
    </div>
  );
}
