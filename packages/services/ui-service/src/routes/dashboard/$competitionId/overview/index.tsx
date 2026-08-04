import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ToggleTabs } from "@/components/toggle-tabs";
import { SearchInput } from "@/components/search-input";
import { DataTable } from "@/components/data-table";
import type { Column } from "@/components/data-table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageSkeleton } from "@/components/skeletons";
import { SurfaceSlot } from "@/components/surface-slot";
import { surface } from "@open-competition-kit/sdk/surface";
import { ClipboardList } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ensureAdmin } from "@/lib/admin";
import { useMemo, useState } from "react";
import { z } from "zod";

type SubmissionRow = {
  id: string;
  user: string;
  track: string;
  trackId: string;
  status: string;
  submittedAt: string | null;
};

const UNFINISHED = new Set(["pending", "running", "queued", "prepared"]);
const FAILED = new Set(["failed", "error", "cancelled", "timeout"]);

const ALL_TRACKS = "All tracks";

const getDashboardData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    // A server function is a public endpoint — the route guard does not protect it.
    await ensureAdmin();

    const config = await unsafe(sdk.config.get());
    const competition = config.competitions.find((c) => c.id === id);
    if (!competition) {
      return { stats: [], submissions: [], tracks: [] as string[] };
    }

    const enrolments = await unsafe(sdk.enrolments.list({ competition: id }));
    const participants = new Set(enrolments.map((e) => e.user)).size;

    const names = new Map<string, string>();
    const submissions: SubmissionRow[] = [];
    let evaluated = 0;
    let failed = 0;
    let inFlight = 0;

    for (const track of competition.tracks) {
      const forTrack = await unsafe(sdk.submissions.list({ track: track.id }));

      for (const submission of forTrack) {
        const jobs = await unsafe(sdk.jobs.list({ submission: submission.id }));
        const latest = jobs.at(-1);
        const status = latest?.status ?? "no job";

        if (FAILED.has(status)) failed++;
        else if (UNFINISHED.has(status)) inFlight++;
        else if (latest) evaluated++;

        if (!names.has(submission.user)) {
          const user = await unsafe(sdk.users.get(submission.user)).catch(
            () => undefined,
          );
          names.set(submission.user, user?.name || submission.user);
        }

        submissions.push({
          id: submission.id,
          user: names.get(submission.user) ?? submission.user,
          track: track.name ?? track.id,
          trackId: track.id,
          status,
          submittedAt:
            submission.createdAt ?
              new Date(submission.createdAt).toISOString()
            : null,
        });
      }
    }

    submissions.sort((a, b) =>
      (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""),
    );

    return {
      tracks: competition.tracks.map((t) => t.name ?? t.id),
      stats: [
        { title: "Participants", value: participants, hint: "Enrolled across all tracks" },
        { title: "Submissions", value: submissions.length, hint: "All time" },
        { title: "Evaluated", value: evaluated, hint: `${inFlight} still running` },
        { title: "Failed", value: failed, hint: "Jobs that errored out" },
      ],
      submissions,
    };
  });

function StatusPill({ status }: { status: string }) {
  const tone =
    FAILED.has(status) ? "bg-destructive/10 text-destructive"
    : UNFINISHED.has(status) ? "bg-warning/10 text-warning"
    : status === "no job" ? "bg-muted text-muted-foreground"
    : "bg-success/10 text-success";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}
    >
      {status}
    </span>
  );
}

const columns: Column<SubmissionRow>[] = [
  {
    key: "user",
    header: "Competitor",
    render: (row) => <span className="font-medium">{row.user}</span>,
  },
  { key: "track", header: "Track", render: (row) => row.track },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusPill status={row.status} />,
  },
  {
    key: "submittedAt",
    header: "Submitted",
    render: (row) => (
      <span className="text-muted-foreground">
        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "-"}
      </span>
    ),
  },
];

export const Route = createFileRoute("/dashboard/$competitionId/overview/")({
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { data: session } = authClient.useSession();
  const { competitionId } = Route.useParams();
  const fetchDashboardData = useServerFn(getDashboardData);
  const [track, setTrack] = useState(ALL_TRACKS);
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", competitionId],
    queryFn: () => fetchDashboardData({ data: competitionId }),
  });

  const submissions = useMemo(() => {
    const all = data?.submissions ?? [];
    const needle = query.trim().toLowerCase();

    return all.filter(
      (row) =>
        (track === ALL_TRACKS || row.track === track) &&
        (!needle ||
          row.user.toLowerCase().includes(needle) ||
          row.track.toLowerCase().includes(needle)),
    );
  }, [data?.submissions, track, query]);

  if (isLoading) return <PageSkeleton />;

  const stats = data?.stats ?? [];
  const tracks = [ALL_TRACKS, ...(data?.tracks ?? [])];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${session?.user?.name ?? "organiser"}`}
        description="Here's how your competition is going."
      />

      {tracks.length > 1 ?
        <ToggleTabs tabs={tracks} onChange={setTrack} />
      : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* The organiser's side of the same arrangement: where a package put the
          competition's things, so nobody has to read the config to find them. */}
      <SurfaceSlot
        surface={surface.std.dashboardOverview}
        subject={{ competition: competitionId }}
        layout="inline"
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {submissions.length} submission{submissions.length === 1 ? "" : "s"}
        </p>
        <SearchInput
          placeholder="Search competitors"
          className="w-64"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>

      {submissions.length ?
        <DataTable columns={columns} data={submissions} />
      : <Empty className="rounded-lg border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No submissions yet</EmptyTitle>
            <EmptyDescription>
              Submissions across this competition's tracks will appear here once
              competitors start entering.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    </div>
  );
}
