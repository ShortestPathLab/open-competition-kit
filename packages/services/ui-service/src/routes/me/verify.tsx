/**
 * Where an organiser confirms the address they signed in with.
 *
 * Under `/me` rather than under `/dashboard`, because what it changes is a
 * property of the account and not of any competition, and because the dashboard
 * guard would bounce the very people this page exists for. `/me/settings`
 * already shows whether an account is confirmed; this is how it becomes so on a
 * deployment with nothing to send mail with.
 */
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { claimMessage, useClaimAdmin, type ClaimResult } from "@/lib/admin-claim-fn";
import { getAdminStatus } from "@/lib/admin";

export const Route = createFileRoute("/me/verify")({
  // Signed out, this page cannot do anything, and an already-confirmed
  // organiser has no reason to look at it.
  beforeLoad: async () => {
    const status = await getAdminStatus();
    if (!status.signedIn) throw redirect({ to: "/sign-in" });
    if (status.isAdmin) throw redirect({ to: "/dashboard" });
    if (!status.mayClaim) throw redirect({ to: "/competitions" });
  },
  component: VerifyPage,
});

function VerifyPage() {
  const router = useRouter();
  const claim = useClaimAdmin();
  const [token, setToken] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure(null);

    const result: ClaimResult = await claim.mutateAsync(token.trim());
    if (result.ok) {
      router.navigate({ to: "/dashboard" });
      return;
    }

    setFailure(claimMessage(result.reason));
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid size-9 place-items-center rounded-lg bg-brand-subtle">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <CardTitle>Confirm this is your address</CardTitle>
          <CardDescription>
            Your address is listed as an organiser. Enter the deployment's admin token to confirm
            the account is yours and open the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-token">Admin token</FieldLabel>
                <Input
                  id="admin-token"
                  name="admin-token"
                  type="password"
                  autoComplete="off"
                  autoFocus
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={claim.isPending}
                />
                <FieldDescription>
                  Set as <code className="font-mono">adminToken</code> in the config. If the
                  deployment does not set one, the service generated a token and printed it to its
                  logs at startup.
                </FieldDescription>
              </Field>

              {failure ? (
                <p className="text-sm text-destructive" role="alert">
                  {failure}
                </p>
              ) : null}

              <Button type="submit" disabled={claim.isPending || token.trim().length === 0}>
                <KeyRound className="size-3.5" />
                {claim.isPending ? "Checking" : "Confirm"}
              </Button>

              <FieldDescription>
                Signing in through a social provider confirms the address on its own.
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
