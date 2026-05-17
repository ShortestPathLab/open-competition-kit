import type { ComponentDef, $props } from "@open-competition-kit/sdk";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, themeQuartz } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import React from "react";
import { meta, shape, value } from "@open-competition-kit/sdk/z";
import { z } from "zod";

type LeaderboardProps = typeof $props.leaderboard.ui;
type LeaderboardDef = LeaderboardProps["def"];
type LeaderboardItem = LeaderboardDef["items"][number];

const propsSchema = z.object({
  ...meta.shape,
  shape: z.object({ ...shape.shape, ...meta.shape }).array(),
  items: z.record(z.string(), value).array(),
}) satisfies z.ZodType<LeaderboardDef>;

type ParsedLeaderboardDef = z.infer<typeof propsSchema> & LeaderboardDef;

const defaultColDef: ColDef<LeaderboardItem> = {
  sortable: true,
  filter: true,
  resizable: true,
};

const theme = themeQuartz.withParams({
  accentColor: "#0f766e",
  borderColor: "#cbd5e1",
  borderRadius: 14,
  browserColorScheme: "light",
  fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
  foregroundColor: "#0f172a",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#0f172a",
  rowBorder: { color: "#e2e8f0" },
  wrapperBorder: false,
});

function formatCellValue(value: LeaderboardItem[keyof LeaderboardItem]) {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function Leaderboard({ def }: LeaderboardProps) {
  const result = z.safeParse(
    propsSchema as z.ZodType<ParsedLeaderboardDef>,
    def,
  );
  if (!result.success)
    throw new Error(
      `Error: ${z.prettifyError(result.error)}\nReceived: ${JSON.stringify(def, null, 2)}`,
    );

  const leaderboard = result.data;
  const columnDefs = leaderboard.shape.map<ColDef<LeaderboardItem>>(
    (shapeItem, index) => ({
      field: shapeItem.id,
      headerName: shapeItem.name,
      minWidth: index === 0 ? 110 : 160,
      flex: index === 1 ? 1 : undefined,
      pinned: index < 2 ? "left" : undefined,
      sort: index === 0 ? "asc" : undefined,
      cellDataType:
        shapeItem.kind === "number" ? "number"
        : shapeItem.kind === "boolean" ? "boolean"
        : "text",
      valueFormatter: ({ value }) => formatCellValue(value),
    }),
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24 }}>
          {leaderboard.name ?? "AG Grid Leaderboard Sample"}
        </h2>
        <p style={{ margin: "8px 0 0" }}>
          {leaderboard.description ??
            "Use this mock leaderboard to confirm sorting, filtering, resizing, and pinned shape items are all working."}
        </p>
      </div>

      <div style={{ minHeight: 420, overflow: "hidden", borderRadius: 12 }}>
        <AgGridProvider modules={[AllCommunityModule]}>
          <AgGridReact<LeaderboardItem>
            theme={theme}
            rowData={[...leaderboard.items]}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows
            pagination
            paginationPageSize={Math.min(
              Math.max(leaderboard.items.length, 1),
              10,
            )}
            domLayout="normal"
            overlayNoRowsTemplate="No leaderboard items yet."
          />
        </AgGridProvider>
      </div>
    </div>
  );
}

export default {
  component: Leaderboard,
  path: import.meta.path,
} satisfies ComponentDef<LeaderboardProps>;
