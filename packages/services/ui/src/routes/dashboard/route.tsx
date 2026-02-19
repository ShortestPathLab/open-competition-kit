import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Navbar } from "*/components/navbar";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="min-h-screen">
      <Navbar variant="admin" />
      <Outlet />
    </div>
  );
}
