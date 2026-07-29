import type { ComponentDef, $props } from "@open-competition-kit/sdk";
import { meta, shape, value } from "@open-competition-kit/sdk/z";
import { useHostDarkMode } from "@open-competition-kit/sdk/theme";
import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";
import { dark, light, seriesColour, type Theme } from "./theme";

type ChartProps = typeof $props.leaderboard.ui;
type ChartDef = ChartProps["def"];

const propsSchema = z.object({
  ...meta.shape,
  shape: z.object({ ...shape.shape, ...meta.shape }).array(),
  items: z.record(z.string(), value).array(),
  options: z.record(z.string(), z.any()).optional(),
}) satisfies z.ZodType<ChartDef>;

type Parsed = z.infer<typeof propsSchema> & ChartDef;
type Item = Parsed["items"][number];

const KINDS = ["bar", "line", "area"] as const;
type Kind = (typeof KINDS)[number];

const asNumber = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
};

/**
 * A field is plottable if the config says so, or — when the config is silent —
 * if every row that has a value for it can be read as a number. Inferring keeps
 * `kind:` optional in YAML for the common case.
 */
const isNumeric = (id: string, items: Item[], declared?: string) => {
  if (declared === "number") return true;
  if (declared && declared !== "number") return false;
  const present = items.filter((i) => i[id] !== undefined && i[id] !== null);
  return present.length > 0 && present.every((i) => asNumber(i[id]) !== undefined);
};

function Empty({ theme, message }: { theme: Theme; message: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        border: `1px dashed ${theme.border}`,
        borderRadius: 12,
        color: theme.textSecondary,
        display: "flex",
        fontSize: 14,
        justifyContent: "center",
        minHeight: 220,
        padding: 24,
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}

function TooltipCard({
  active,
  payload,
  label,
  theme,
}: {
  active?: boolean;
  payload?: { name?: string; value?: unknown; color?: string }[];
  label?: unknown;
  theme: Theme;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        boxShadow: "0 6px 16px rgba(0,0,0,0.14)",
        fontSize: 13,
        minWidth: 140,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          color: theme.textPrimary,
          fontWeight: 600,
          marginBottom: payload.length ? 6 : 0,
        }}
      >
        {String(label ?? "")}
      </div>
      {payload.map((entry) => (
        <div
          key={entry.name}
          style={{
            alignItems: "center",
            color: theme.textSecondary,
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            padding: "2px 0",
          }}
        >
          <span style={{ alignItems: "center", display: "flex", gap: 6 }}>
            <span
              style={{
                background: entry.color,
                borderRadius: 3,
                display: "inline-block",
                height: 10,
                width: 10,
              }}
            />
            {entry.name}
          </span>
          {/* Values wear text ink, not the series colour. */}
          <span style={{ color: theme.textPrimary, fontVariantNumeric: "tabular-nums" }}>
            {String(entry.value ?? "-")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Chart({ def }: ChartProps) {
  const isDark = useHostDarkMode();
  const theme = isDark ? dark : light;

  const result = z.safeParse(propsSchema as z.ZodType<Parsed>, def);
  if (!result.success) {
    throw new Error(
      `Error: ${z.prettifyError(result.error)}\nReceived: ${JSON.stringify(def, null, 2)}`,
    );
  }

  const board = result.data;
  const items = [...board.items];
  const options = board.options ?? {};

  const kind = (
    KINDS.includes(options.kind as Kind) ? options.kind : "bar"
  ) as Kind;
  const stacked = options.stacked === true;
  const height = typeof options.height === "number" ? options.height : 360;

  const declared = new Map(board.shape.map((s) => [s.id, s.kind]));
  const labelOf = (id: string) =>
    board.shape.find((s) => s.id === id)?.name ?? id;

  // The category axis defaults to the first non-numeric column — on a
  // leaderboard that is almost always the competitor.
  const category =
    (options.x as string | undefined) ??
    board.shape.find((s) => !isNumeric(s.id, items, declared.get(s.id)))?.id ??
    board.shape[0]?.id;

  const plottable = board.shape
    .filter(
      (s) =>
        s.id !== category &&
        // `rank` is an index, not a measure. Plotting it against a score would
        // put 1..N and 0..100 on the same axis and flatten both.
        s.id !== "rank" &&
        isNumeric(s.id, items, declared.get(s.id)),
    )
    .map((s) => s.id);

  const configured = Array.isArray(options.series)
    ? (options.series as string[])
    : undefined;

  // Default to a single measure. Columns on a leaderboard routinely differ by
  // orders of magnitude (a score of 98 beside 1,610ms), and stacking them on one
  // axis renders the smaller one invisible — so plotting more than one is an
  // explicit choice, made with `options.series`.
  const series = (configured ?? plottable.slice(0, 1)).slice(0, 8);

  if (!items.length) {
    return <Empty theme={theme} message="No results yet." />;
  }
  if (!category || !series.length) {
    return (
      <Empty
        theme={theme}
        message="Nothing to plot. Give this leaderboard at least one numeric column, or set `options.series`."
      />
    );
  }

  const data = items.map((item) => ({
    ...item,
    [category]: String(item[category] ?? ""),
    ...Object.fromEntries(series.map((s) => [s, asNumber(item[s]) ?? 0])),
  }));

  const axis = {
    stroke: theme.grid,
    tick: { fill: theme.textSecondary, fontSize: 12 },
    tickLine: false,
  };

  // A legend is mandatory for two or more series so identity never rests on
  // colour alone — and it doubles as the secondary encoding the dark palette needs.
  const legend =
    series.length > 1 ?
      <Legend
        wrapperStyle={{ color: theme.textSecondary, fontSize: 12, paddingTop: 8 }}
      />
    : null;

  const tooltip = (
    <Tooltip
      content={<TooltipCard theme={theme} />}
      cursor={{ fill: theme.grid, fillOpacity: isDark ? 0.35 : 0.5 }}
    />
  );

  const grid = (
    <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
  );

  const common = { data, margin: { bottom: 4, left: 4, right: 12, top: 8 } };

  return (
    // The plot's own surface. The host places a chart the way it places any
    // other renderer, bare and under the board's heading, so the card has to
    // come from here. Custom properties cross the shadow boundary, so it takes
    // the page's palette and radius when there is a page, and the theme's own
    // values when the chart renders alone. `boxSizing` is spelled out because
    // no reset reaches inside a shadow root.
    <div
      style={{
        background: `var(--card, ${theme.surface})`,
        border: `1px solid var(--border, ${theme.border})`,
        borderRadius: "var(--radius, 12px)",
        boxSizing: "border-box",
        padding: 16,
        width: "100%",
      }}
    >
      <ResponsiveContainer height={height} width="100%">
        {kind === "line" ?
          <LineChart {...common}>
            {grid}
            <XAxis dataKey={category} {...axis} />
            <YAxis {...axis} />
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Line
                activeDot={{ r: 5, stroke: theme.surface, strokeWidth: 2 }}
                dataKey={s}
                dot={false}
                key={s}
                name={labelOf(s)}
                stroke={seriesColour(theme, i)}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </LineChart>
        : kind === "area" ?
          <AreaChart {...common}>
            {grid}
            <XAxis dataKey={category} {...axis} />
            <YAxis {...axis} />
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Area
                dataKey={s}
                fill={seriesColour(theme, i)}
                fillOpacity={0.15}
                key={s}
                name={labelOf(s)}
                stackId={stacked ? "stack" : undefined}
                stroke={seriesColour(theme, i)}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </AreaChart>
        : <BarChart {...common} barCategoryGap="20%">
            {grid}
            <XAxis dataKey={category} {...axis} />
            <YAxis {...axis} />
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Bar
                dataKey={s}
                fill={seriesColour(theme, i)}
                key={s}
                name={labelOf(s)}
                // Rounded data-end anchored to the baseline. Stacked segments stay
                // square so they read as one column.
                radius={stacked ? 0 : [4, 4, 0, 0]}
                stackId={stacked ? "stack" : undefined}
                // A 2px surface-coloured edge is the gap between adjacent and
                // stacked fills.
                stroke={theme.surface}
                strokeWidth={2}
              />
            ))}
          </BarChart>
        }
      </ResponsiveContainer>
    </div>
  );
}

export default {
  component: Chart,
  path: import.meta.path,
} satisfies ComponentDef<ChartProps>;
