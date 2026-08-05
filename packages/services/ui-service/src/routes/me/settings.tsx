import { MePageHeader } from "@/components/me-page-header";
import { PageBody } from "@/components/page-header-band";
import { SectionHeader } from "@/components/section-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListSkeleton } from "@/components/skeletons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Lock, LogOut } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/me/settings")({
  component: MeSettingsPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function MeSettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const user = session?.user;

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
    <>
      <MePageHeader
        title="Settings"
        description="Your account, as competition organisers see it."
        actions={
          user ? (
            <Button
              variant="outline"
              size="lg"
              className="h-10 px-5"
              onClick={signOut}
              disabled={signingOut}
            >
              <LogOut />
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          ) : undefined
        }
        tabs
      />
      <PageBody>
        {isPending ? (
          <ListSkeleton aria-label="Loading your account details..." />
        ) : !user ? (
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
        ) : (
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
                  user.emailVerified ? (
                    <span className="text-success">Verified</span>
                  ) : (
                    <span className="text-warning">Not verified</span>
                  )
                }
              />
              <Row label="User ID" value={<code className="font-mono text-xs">{user.id}</code>} />
            </div>
            {/* Profile details come from the identity provider, so this
                deployment has nowhere to write an edit back to. */}
            <p className="text-xs text-muted-foreground">
              Your name and email are managed by the provider you signed in with.
            </p>
          </section>
        )}
      </PageBody>
    </>
  );
}
