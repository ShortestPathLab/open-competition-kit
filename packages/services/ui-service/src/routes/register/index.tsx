import { SignupForm } from "@/components/signup-form";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthConfig } from "@/lib/get-auth";

export const Route = createFileRoute("/register/")({
  beforeLoad: async () => {
    const config = await getAuthConfig();
    if (!config.emailEnabled) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <SignupForm className="w-full max-w-md" />
    </div>
  );
}
