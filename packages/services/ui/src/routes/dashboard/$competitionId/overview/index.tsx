import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";
import { PageHeader } from "*/components/page-header";
import { StatCard } from "*/components/stat-card";
import { ToggleTabs } from "*/components/toggle-tabs";
import { FilterBar } from "*/components/filter-bar";
import { DataTable } from "*/components/data-table";
import type { Column } from "*/components/data-table";
import { Copy, ExternalLink } from "lucide-react";

interface Submission {
  id: string;
  checked: boolean;
  result: number;
}

const getDashboardData = createServerFn({ method: "GET" }).handler(
  async (ctx: any) => {
    const id = ctx.data as string;

    // TODO: Implement SDK functions
    // @ts-ignore
    const _stats = await sdk.competitions.getStats(id);
    // @ts-ignore
    const _submissions = await sdk.competitions.getSubmissions(id);

    return {
      stats: [
        { title: "Participants", value: 2420, change: 40 },
        { title: "Best sum-of-costs", value: 1210, change: -10 },
        { title: "Something else", value: 316, change: 20 },
      ],
      submissions: Array.from({ length: 7 }, (_, i) => ({
        id: `sub-${i}`,
        checked: i < 3 || i > 4,
        result: Math.random() * 100,
      })),
    };
  },
);

const columns: Column<Submission>[] = [
  {
    key: "submission",
    header: "Submission",
    render: (row) => (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          defaultChecked={row.checked}
          className="rounded border-border"
        />
        <div className="h-7 w-7 rounded-full bg-muted" />
      </div>
    ),
  },
  {
    key: "result",
    header: "Result",
    render: (row) => (
      <div className="h-2 w-full max-w-xs rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${row.result}%` }}
        />
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: () => (
      <div className="h-4 w-4 rounded-full border-2 border-border" />
    ),
  },
  {
    key: "smth",
    header: "Smth",
    render: () => (
      <div className="h-4 w-4 rounded-full border-2 border-border" />
    ),
  },
];

const filters = [
  { id: "time", label: "All time" },
  { id: "regions", label: "US, AU, +4" },
];

export const Route = createFileRoute("/dashboard/$competitionId/overview/")({
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { competitionId } = Route.useParams();
  const fetchDashboardData = useServerFn(getDashboardData);

  const { data } = useQuery({
    queryKey: ["dashboard", competitionId],
    queryFn: () => (fetchDashboardData as any)({ data: competitionId }),
  });

  const stats = data?.stats ?? [];
  const submissions = data?.submissions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Welcome back, Daniel"
        description="Here's how your competition is going."
        actions={
          <>
            <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm">
              <Copy className="h-4 w-4" />
              Make a copy
            </button>
            <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              <ExternalLink className="h-4 w-4" />
              Export
            </button>
          </>
        }
      />

      <ToggleTabs tabs={["All tracks", "Single-agent", "Multi-agent"]} />

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat: any) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <FilterBar filters={filters} searchPlaceholder="Search" />

      <DataTable
        columns={columns}
        data={submissions}
        page={1}
        totalPages={10}
      />
    </div>
  );
}
