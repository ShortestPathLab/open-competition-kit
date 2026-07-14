import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAdminStatus } from "src/lib/admin";

export const Route = createFileRoute("/dashboard")({
  // Guard in `beforeLoad`, not in the component: throwing here stops the child
  // routes' loaders from running at all, so organiser data is never fetched —
  // let alone serialised into the page — for someone who may not see it.
  beforeLoad: async () => {
    const status = await getAdminStatus();

    if (!status.signedIn) throw redirect({ to: "/sign-in" });
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
