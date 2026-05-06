import type { ComponentDef } from "sdk";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, themeQuartz } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import React from "react";

type LeaderboardRow = {
  rank: number;
  team: string;
  score: number;
  submissions: number;
  accuracy: number;
  lastUpdated: string;
  status: "Qualified" | "Review" | "Pending";
};

const rowData: LeaderboardRow[] = [
  {
    rank: 1,
    team: "Gradient Boosters",
    score: 98.42,
    submissions: 14,
    accuracy: 0.9842,
    lastUpdated: "2026-05-06 09:12",
    status: "Qualified",
  },
  {
    rank: 2,
    team: "Feature Foundry",
    score: 97.88,
    submissions: 11,
    accuracy: 0.9788,
    lastUpdated: "2026-05-06 08:47",
    status: "Qualified",
  },
  {
    rank: 3,
    team: "Token Titans",
    score: 97.31,
    submissions: 9,
    accuracy: 0.9731,
    lastUpdated: "2026-05-06 08:29",
    status: "Review",
  },
  {
    rank: 4,
    team: "Baseline Breakers",
    score: 95.67,
    submissions: 7,
    accuracy: 0.9567,
    lastUpdated: "2026-05-05 21:03",
    status: "Pending",
  },
  {
    rank: 5,
    team: "Loss Function Club",
    score: 94.95,
    submissions: 12,
    accuracy: 0.9495,
    lastUpdated: "2026-05-05 18:40",
    status: "Qualified",
  },
];

const columnDefs: ColDef<LeaderboardRow>[] = [
  {
    field: "rank",
    headerName: "Rank",
    width: 92,
    pinned: "left",
    sort: "asc",
  },
  {
    field: "team",
    headerName: "Team",
    minWidth: 220,
    flex: 1,
    pinned: "left",
  },
  {
    field: "score",
    headerName: "Score",
    minWidth: 120,
    cellDataType: "number",
    valueFormatter: ({ value }) => value?.toFixed(2) ?? "-",
  },
  {
    field: "accuracy",
    headerName: "Accuracy",
    minWidth: 130,
    cellDataType: "number",
    valueFormatter: ({ value }) =>
      typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "-",
  },
  {
    field: "submissions",
    headerName: "Submissions",
    minWidth: 140,
    cellDataType: "number",
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 130,
  },
  {
    field: "lastUpdated",
    headerName: "Last Updated",
    minWidth: 180,
  },
];

const defaultColDef: ColDef<LeaderboardRow> = {
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

export function Leaderboard() {
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
        <h2 style={{ margin: 0, fontSize: 24 }}>AG Grid Leaderboard Sample</h2>
        <p style={{ margin: "8px 0 0", color: "#475569" }}>
          Use this mock leaderboard to confirm sorting, filtering, resizing, and
          pinned columns are all working.
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
          <AgGridReact<LeaderboardRow>
            theme={theme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows
            pagination
            paginationPageSize={5}
            domLayout="normal"
          />
        </AgGridProvider>
      </div>
    </div>
  );
}

export default {
  component: Leaderboard,
  path: import.meta.path,
} satisfies ComponentDef;
