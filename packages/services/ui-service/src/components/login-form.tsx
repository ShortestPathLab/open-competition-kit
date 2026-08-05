import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { authFetchOptions, authRequestErrorMessage } from "@/lib/auth-request";
import { getAuthConfig } from "@/lib/get-auth";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const providerLabel = (provider: string) => provider.charAt(0).toUpperCase() + provider.slice(1);

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const fetchAuthConfig = useServerFn(getAuthConfig);
  const { data: authConfig } = useQuery({
    queryKey: ["authConfig"],
    queryFn: () => fetchAuthConfig(),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Which sign-in is in flight: "email", `social:${provider}`, or none. */
  const [pending, setPending] = useState<string | null>(null);
  const busy = pending !== null;

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending("email");
    try {
      const { error } = await authClient.signIn.email({ email, password }, authFetchOptions);
      if (error) {
        setError(error.message ?? "Sign in failed. Check your details and try again.");
        setPending(null);
        return;
      }
      // Only navigate once the credentials are actually accepted, and leave
      // `pending` set on the way out so the button doesn't flash back to
      // "Sign in" while the next route loads.
      router.navigate({
        to: "/sign-in/complete/$method",
        params: { method: "email" },
      });
    } catch (err) {
      setError(authRequestErrorMessage(err));
      setPending(null);
    }
  };

  const handleSocialSignIn = async (provider: string) => {
    setError(null);
    setPending(`social:${provider}`);
    try {
      const { error } = await authClient.signIn.social(
        {
          provider: provider as "github",
          callbackURL: `/sign-in/complete/${provider}`,
        },
        authFetchOptions,
      );
      if (error) {
        setError(error.message ?? `Couldn't sign in with ${providerLabel(provider)}. Try again.`);
        setPending(null);
      }
      // On success the browser is handed off to the provider, so the form is on
      // its way out — keep the buttons disabled.
    } catch (err) {
      setError(authRequestErrorMessage(err));
      setPending(null);
    }
  };

  const emailEnabled = authConfig?.emailEnabled ?? false;
  const socialProviders = authConfig?.socialProviders ?? [];

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Sign in to your account</CardTitle>
          <CardDescription>
            {emailEnabled ? "Enter your email below to sign in" : "Choose a sign-in method"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {emailEnabled && (
              <form onSubmit={handleEmailSignIn}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Field>
                    <Button type="submit" disabled={busy} size="lg">
                      {pending === "email" ? "Signing in..." : "Sign in"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            )}
            {emailEnabled && socialProviders.length > 0 && (
              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground uppercase">Or</span>
                <Separator className="flex-1" />
              </div>
            )}
            {socialProviders.map((provider) => (
              <Button
                key={provider}
                size="lg"
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => handleSocialSignIn(provider)}
              >
                {pending === `social:${provider}`
                  ? `Connecting to ${providerLabel(provider)}...`
                  : `Sign in with ${providerLabel(provider)}`}
              </Button>
            ))}
            {emailEnabled && (
              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <Link to="/register" className="underline underline-offset-4">
                  Sign up
                </Link>
              </FieldDescription>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
