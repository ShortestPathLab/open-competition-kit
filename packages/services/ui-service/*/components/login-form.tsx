import { cn } from "*/lib/utils";
import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "*/components/ui/field";
import { Input } from "*/components/ui/input";
import { Separator } from "*/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { getAuthConfig } from "src/lib/get-auth";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { configureUser } from "src/lib/configure-user";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const fetchAuthConfig = useServerFn(getAuthConfig);
  const { data: authConfig } = useQuery({
    queryKey: ["authConfig"],
    queryFn: () => fetchAuthConfig(),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    await authClient.signIn.email(
      { email, password },
      {
        onError: (ctx) => {
          setError(ctx.error.message);
        },
      },
    );
    router.navigate({
      to: "/sign-in/complete/$method",
      params: { method: "email" },
    });
    setLoading(false);
  };

  const handleSocialSignIn = async (provider: string) => {
    const result = await authClient.signIn.social({
      provider: provider as "github",
      callbackURL: `/sign-in/complete/${provider}`,
    });
    if (result.data && "user" in result.data) {
      console.log(result);
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
            {emailEnabled ?
              "Enter your email below to sign in"
            : "Choose a sign-in method"}
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
                    <Button type="submit" disabled={loading} size="lg">
                      {loading ? "Signing in..." : "Sign in"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            )}
            {emailEnabled && socialProviders.length > 0 && (
              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground uppercase">
                  Or
                </span>
                <Separator className="flex-1" />
              </div>
            )}
            {socialProviders.map((provider) => (
              <Button
                key={provider}
                size="lg"
                variant="outline"
                type="button"
                onClick={() => handleSocialSignIn(provider)}
              >
                Sign in with{" "}
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
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
