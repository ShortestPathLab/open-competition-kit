import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAdminStatus } from "@/lib/admin";

export const Route = createFileRoute("/dashboard")({
  // Guard in `beforeLoad`, not in the component: throwing here stops the child
  // routes' loaders from running at all, so organiser data is never fetched —
  // let alone serialised into the page — for someone who may not see it.
  beforeLoad: async () => {
    const status = await getAdminStatus();

    if (!status.signedIn) throw redirect({ to: "/sign-in" });

    // Listed but not confirmed. Sending them to the competitions page like any
    // other non-organiser would be technically correct and useless: they are the
    // organiser, they are one step from proving it, and nothing on that page
    // says so.
    if (status.mayClaim) throw redirect({ to: "/me/verify" });

    if (!status.isAdmin) throw redirect({ to: "/competitions" });

    return { admin: status };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
