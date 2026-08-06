import { max } from "es-toolkit/compat";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/panel";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { bestScores, byDay, histogram } from "@/lib/dashboard-charts";
import type { ActivityRow } from "@/lib/dashboard-data";

/**
 * One hue for both charts, and one hue in both themes.
 *
 * Each chart carries a single series, so there is no identity to encode and
 * nothing a second colour could say. `--chart-2` is the step of the app's own
 * ramp that clears the lightness band and the 3:1 contrast floor against the
 * light surface and the dark one, which the steps either side of it do not: the
 * lighter one washes out on white and the darker disappears on the dark card.
 *
 * Deliberately not the status colours the pills and badges use. Amber against
 * red is nearly indistinguishable to a protanope, so a chart segmented by run
 * outcome would be unreadable for some organisers however carefully it was
 * labelled. Those three figures are in the header strip, where they are numbers
 * with words beside them and colour is only decoration.
 */
const SERIES_COLOR = "var(--chart-2)";

/** The shared frame: a titled panel that says something useful when it is empty. */
function ChartPanel({
  title,
  note,
  empty,
  children,
}: {
  title: string;
  /** A fact worth putting in the header, once there is data to draw. */
  note?: string;
  /** What to say instead of a chart. Rendering the chart is the alternative. */
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {!empty && note ? (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{note}</span>
        ) : null}
      </PanelHeader>
      {empty ? (
        <PanelBody className="text-sm text-muted-foreground">{empty}</PanelBody>
      ) : (
        <PanelBody>{children}</PanelBody>
      )}
    </Panel>
  );
}

/** Axis and grid settings shared by both charts, so the pair reads as one system. */
const GRID = <CartesianGrid vertical={false} stroke="var(--border)" />;

const AXIS_PROPS = { tickLine: false, axisLine: false, className: "text-xs" } as const;

const activityConfig = {
  submissions: { label: "Submissions", color: SERIES_COLOR },
} satisfies ChartConfig;

/**
 * When the work is arriving.
 *
 * The question the totals above cannot answer. An organiser watching a deadline
 * needs to know whether the rush has started, and "412 submissions" is the same
 * number whether they all came in last night or trickled in over a month.
 */
export function ActivityChart({ rows, loading }: { rows: ActivityRow[]; loading: boolean }) {
  const data = useMemo(() => byDay(rows), [rows]);
  const busiest = useMemo(() => max(data.map((point) => point.submissions)) ?? 0, [data]);

  return (
    <ChartPanel
      title="Submissions per day"
      note={`busiest day ${busiest}`}
      empty={
        data.length
          ? undefined
          : loading
            ? "Reading this competition's activity..."
            : "Nothing has been submitted yet, so there is no shape to draw."
      }
    >
      <ChartContainer config={activityConfig} className="h-56 w-full">
        <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 4 }}>
          {/* Horizontal rules only. Verticals would draw one line per day and
              compete with the bars sitting in front of them. */}
          {GRID}
          <XAxis dataKey="label" tickMargin={8} minTickGap={24} {...AXIS_PROPS} />
          <YAxis width={28} allowDecimals={false} {...AXIS_PROPS} />
          <ChartTooltip content={<ChartTooltipContent labelKey="label" />} />
          <Bar
            dataKey="submissions"
            fill={SERIES_COLOR}
            // Rounded at the data end and square on the baseline, so a bar reads
            // as growing out of the axis rather than floating over it.
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

const scoreConfig = {
  competitors: { label: "Competitors", color: SERIES_COLOR },
} satisfies ChartConfig;

/**
 * Where the field landed, which a leaderboard cannot say.
 *
 * A leaderboard answers who is winning. This answers whether the competition is
 * pitched right: everybody bunched at the bottom means the task is too hard,
 * everybody bunched at the top means it separates nobody, and either is only
 * worth knowing while there is still time to say something about it.
 */
export function ScoreDistributionChart({
  rows,
  loading,
}: {
  rows: ActivityRow[];
  loading: boolean;
}) {
  const scores = useMemo(() => bestScores(rows), [rows]);
  const data = useMemo(() => histogram(scores), [scores]);

  return (
    <ChartPanel
      title="Best score per competitor"
      note={`${scores.length} scored`}
      empty={
        data.length
          ? undefined
          : loading
            ? "Reading this competition's results..."
            : // Two different absences, and an organiser acts on them
              // differently: one waits, the other goes and looks at the runner.
              "No run has produced a score yet. A runner writes one to the default output; until one does there is nothing to distribute."
      }
    >
      <ChartContainer config={scoreConfig} className="h-56 w-full">
        <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 4 }}>
          {GRID}
          <XAxis dataKey="label" tickMargin={8} minTickGap={8} {...AXIS_PROPS} />
          <YAxis width={28} allowDecimals={false} {...AXIS_PROPS} />
          <ChartTooltip content={<ChartTooltipContent labelKey="label" />} />
          <Bar dataKey="competitors" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}
