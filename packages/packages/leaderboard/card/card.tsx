import type { ComponentDef, $props } from "@open-competition-kit/sdk";
import { meta, shape, value } from "@open-competition-kit/sdk/z";
import React from "react";
import { z } from "zod";
import { dark, light, seriesColour, type Theme } from "./theme";

type CardProps = typeof $props.leaderboard.ui;
type CardDef = CardProps["def"];

const propsSchema = z.object({
  ...meta.shape,
  shape: z.object({ ...shape.shape, ...meta.shape }).array(),
  items: z.record(z.string(), value).array(),
  options: z.record(z.string(), z.any()).optional(),
}) satisfies z.ZodType<CardDef>;

type Parsed = z.infer<typeof propsSchema> & CardDef;
type Item = Parsed["items"][number];

function usePrefersDark() {
  const query = "(prefers-color-scheme: dark)";
  const [isDark, setIsDark] = React.useState(
    () => globalThis.matchMedia?.(query).matches ?? false,
  );

  React.useEffect(() => {
    const mq = globalThis.matchMedia?.(query);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isDark;
}

const asNumber = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
};

const isNumeric = (id: string, items: Item[], declared?: string) => {
  if (declared === "number") return true;
  if (declared && declared !== "number") return false;
  const present = items.filter((i) => i[id] !== undefined && i[id] !== null);
  return present.length > 0 && present.every((i) => asNumber(i[id]) !== undefined);
};

/** Keep long scores readable without lying about them. */
const format = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const n = asNumber(v);
  if (n === undefined) return String(v);
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

export function Cards({ def }: CardProps) {
  const isDark = usePrefersDark();
  const theme: Theme = isDark ? dark : light;

  const result = z.safeParse(propsSchema as z.ZodType<Parsed>, def);
  if (!result.success) {
    throw new Error(
      `Error: ${z.prettifyError(result.error)}\nReceived: ${JSON.stringify(def, null, 2)}`,
    );
  }

  const board = result.data;
  const options = board.options ?? {};
  const declared = new Map(board.shape.map((s) => [s.id, s.kind]));

  const all = [...board.items];
  const limit = typeof options.limit === "number" ? options.limit : undefined;
  const items = limit && limit > 0 ? all.slice(0, limit) : all;

  const numericFields = board.shape.filter((s) =>
    isNumeric(s.id, all, declared.get(s.id)),
  );

  // The headline number, and the label that identifies whose it is.
  const metric =
    (options.metric as string | undefined) ??
    numericFields.find((s) => s.id !== "rank")?.id ??
    numericFields[0]?.id;

  const title =
    (options.title as string | undefined) ??
    board.shape.find(
      (s) => s.id !== metric && s.id !== "rank" && !isNumeric(s.id, all, declared.get(s.id)),
    )?.id;

  const labelOf = (id: string) =>
    board.shape.find((s) => s.id === id)?.name ?? id;

  // Everything else becomes a supporting stat line on the card.
  const supporting = board.shape.filter(
    (s) => s.id !== metric && s.id !== title && s.id !== "rank",
  );

  const columns =
    typeof options.columns === "number" ? options.columns
    : Math.min(Math.max(items.length, 1), 3);

  if (!items.length) {
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
          minHeight: 160,
          padding: 24,
        }}
      >
        No results yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        maxWidth: columns * 360,
      }}
    >
      {items.map((item, index) => {
        const rank = asNumber(item.rank) ?? index + 1;
        const accent = seriesColour(theme, index);

        return (
          <div
            key={`${String(item.job ?? item.submission ?? index)}`}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 14,
              display: "grid",
              gap: 12,
              padding: 20,
              // A quiet accent rail carries identity without colouring the text.
              borderLeft: `3px solid ${accent}`,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  color: theme.textSecondary,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title ? format(item[title]) : (board.name ?? "Result")}
              </span>
              <span
                style={{
                  background: theme.grid,
                  borderRadius: 999,
                  color: theme.textSecondary,
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  padding: "2px 8px",
                }}
              >
                #{rank}
              </span>
            </div>

            {metric ?
              <div style={{ display: "grid", gap: 2 }}>
                <span
                  style={{
                    color: theme.textPrimary,
                    fontSize: 34,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 650,
                    lineHeight: 1.1,
                  }}
                >
                  {format(item[metric])}
                </span>
                <span style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {labelOf(metric)}
                </span>
              </div>
            : null}

            {supporting.length ?
              <div
                style={{
                  borderTop: `1px solid ${theme.grid}`,
                  display: "grid",
                  gap: 6,
                  paddingTop: 10,
                }}
              >
                {supporting.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      color: theme.textSecondary,
                      display: "flex",
                      fontSize: 13,
                      gap: 12,
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{s.name ?? s.id}</span>
                    <span
                      style={{
                        color: theme.textPrimary,
                        fontVariantNumeric: "tabular-nums",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {format(item[s.id])}
                    </span>
                  </div>
                ))}
              </div>
            : null}
          </div>
        );
      })}
    </div>
  );
}

export default {
  component: Cards,
  path: import.meta.path,
} satisfies ComponentDef<CardProps>;
