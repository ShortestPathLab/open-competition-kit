import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/me")({ component: MeLayout });

/**
 * Layout, and nothing more.
 *
 * This used to draw one header band for the whole personal area, which every
 * page below inherited: enrolments, submissions and settings all opened with
 * "Your competitions" and its call to action, and only then said which page you
 * were on. Each route now renders its own `MePageHeader` and names the area in
 * the breadcrumb, the same way the competition subtree works.
 */
function MeLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
