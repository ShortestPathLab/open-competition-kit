import { SectionHeader } from "*/components/section-header";
import { Button } from "*/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { PageSkeleton } from "*/components/skeletons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { authClient } from "src/lib/auth-client";
import { Lock, LogOut } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/me/settings")({
  component: MeSettingsPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function MeSettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  if (isPending) return <PageSkeleton />;

  const user = session?.user;

  if (!user) {
    return (
      <Empty className="rounded-2xl border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>Sign in to view your settings</EmptyTitle>
          <EmptyDescription>
            Your account details are only visible when you're signed in.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      await router.navigate({ to: "/sign-in" });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeader
          title="Account"
          description="How you appear to competition organisers."
        />
        <div className="rounded-2xl border border-border px-4">
          <Row label="Name" value={user.name || "-"} />
          <Row label="Email" value={user.email} />
          <Row
            label="Email verified"
            value={
              user.emailVerified ?
                <span className="text-success">Verified</span>
              : <span className="text-warning">Not verified</span>
            }
          />
          <Row
            label="User ID"
            value={<code className="font-mono text-xs">{user.id}</code>}
          />
        </div>
        {/* Profile details come from the identity provider, so this deployment
            has nowhere to write an edit back to. */}
        <p className="text-xs text-muted-foreground">
          Your name and email are managed by the provider you signed in with.
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Session"
          description="Sign out of this browser."
        />
        <Button variant="outline" onClick={signOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </section>
    </div>
  );
}
