import type { ComponentDef, $props } from "sdk";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, themeQuartz } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import React from "react";

type LeaderboardProps = typeof $props.leaderboard.ui;
type LeaderboardItem = LeaderboardProps["items"][number];

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

export function Leaderboard(props: LeaderboardProps) {
  const columnDefs = props.shape.map<ColDef<LeaderboardItem>>(
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
    <div
      style={{
        display: "grid",
        gap: 16,
        padding: 20,
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef6ff 45%, #f8fafc 100%)",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 24 }}>
          {props.label ?? "AG Grid Leaderboard Sample"}
        </h2>
        <p style={{ margin: "8px 0 0", color: "#475569" }}>
          {props.description ??
            "Use this mock leaderboard to confirm sorting, filtering, resizing, and pinned shape items are all working."}
        </p>
      </div>

      <div
        style={{
          minHeight: 420,
          overflow: "hidden",
          border: "1px solid #dbe4f0",
          borderRadius: 18,
          background: "#ffffff",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <AgGridProvider modules={[AllCommunityModule]}>
          <AgGridReact<LeaderboardItem>
            theme={theme}
            rowData={[...props.items]}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows
            pagination
            paginationPageSize={Math.min(Math.max(props.items.length, 1), 10)}
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
