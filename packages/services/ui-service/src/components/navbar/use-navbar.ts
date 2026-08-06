import { getAdminStatus } from "@/lib/admin";
import { authClient } from "@/lib/auth-client";
import { useHasBanner } from "@/lib/banner";
import { getAuthConfig } from "@/lib/get-auth";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

/** Who is reading, what they are allowed to see, and how the bar is painted. */
export function useNavbar() {
  const router = useRouter();
  const banner = useHasBanner();
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

  return {
    banner,
    sessionLoading,
    user: session?.user,
    isLoggedIn: !!session?.user,
    isAdmin: adminStatus?.isAdmin ?? false,
    // An organiser who has not confirmed their address yet. They are not an
    // admin, so the bar owes them a different button rather than the admin one:
    // `isAdmin` is asked of the server for the reason above, and a Sudo button
    // that lands on the claim page is exactly the bounce that comment forbids.
    // Without something here they have no way to reach the page at all, short of
    // being told the URL.
    mayClaim: adminStatus?.mayClaim ?? false,
    emailEnabled: authConfig?.emailEnabled ?? false,
    signOut: async () => {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.navigate({ to: "/" });
          },
        },
      });
    },
  };
}

export type NavbarState = ReturnType<typeof useNavbar>;
export type SessionUser = NonNullable<NavbarState["user"]>;
