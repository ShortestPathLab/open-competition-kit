import type { ComponentDef, $props } from "@open-competition-kit/sdk";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, themeQuartz } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import React from "react";
import { meta, shape, value } from "@open-competition-kit/sdk/z";
import { useHostDarkMode } from "@open-competition-kit/sdk/theme";
import { z } from "zod";

type LeaderboardProps = typeof $props.leaderboard.ui;
type LeaderboardDef = LeaderboardProps["def"];
type LeaderboardItem = LeaderboardDef["items"][number];

const propsSchema = z.object({
  ...meta.shape,
  // `name` sits on the leaderboard def itself, not on `Meta` — a board carries
  // both, and configs use `name`. Declared so a def that carries one parses,
  // even though the grid no longer prints it.
  name: z.string().optional(),
  shape: z.object({ ...shape.shape, ...meta.shape }).array(),
  items: z.record(z.string(), value).array(),
}) satisfies z.ZodType<LeaderboardDef>;

type ParsedLeaderboardDef = z.infer<typeof propsSchema> & LeaderboardDef;

const defaultColDef: ColDef<LeaderboardItem> = {
  sortable: true,
  filter: true,
  resizable: true,
};

/**
 * "Inter Variable" comes from the host's @fontsource import. Font faces
 * registered on the main document are visible inside shadow trees, so this
 * resolves to the same font the page is using, and to a system stack when
 * there is no page.
 */
const FONT_STACK =
  '"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Fallback palettes, from ui-service `src/styles.css`. Used only when nothing
 * above the grid defines these tokens.
 */
const LIGHT = {
  foreground: "oklch(0.1858 0.0294 271.15)",
  card: "oklch(1 0 0)",
  primary: "oklch(0.5106 0.2301 276.97)",
  muted: "oklch(0.9671 0.007 268.55)",
  border: "oklch(0.931 0.0113 269.55)",
};

const DARK = {
  foreground: "oklch(0.9646 0.0096 273.36)",
  card: "oklch(0.1986 0.014 275.62)",
  primary: "oklch(0.6801 0.1583 276.93)",
  muted: "oklch(0.2334 0.016 273.56)",
  border: "oklch(1 0 0 / 9%)",
};

/**
 * AG Grid passes a string param straight through into the CSS it generates, so
 * a param can name a custom property. Custom properties cross a shadow
 * boundary, which means the grid reads the surrounding page's palette and
 * follows it into dark mode without being told, and follows a rebrand of
 * `styles.css` for free. The fallback is what a standalone render gets.
 */
const palette = (fallback: typeof LIGHT) => ({
  accentColor: `var(--primary, ${fallback.primary})`,
  backgroundColor: `var(--card, ${fallback.card})`,
  borderColor: `var(--border, ${fallback.border})`,
  chromeBackgroundColor: `var(--muted, ${fallback.muted})`,
  foregroundColor: `var(--foreground, ${fallback.foreground})`,
  headerBackgroundColor: `var(--muted, ${fallback.muted})`,
  headerTextColor: `var(--foreground, ${fallback.foreground})`,
  rowBorder: { color: `var(--border, ${fallback.border})` },
});

/**
 * `browserColorScheme` is the one param a custom property cannot carry: it
 * drives the native scrollbars and has to be the literal `light` or `dark`.
 * AG Grid scopes a second param set to `[data-ag-theme-mode="dark"]` on an
 * ancestor, which the component sets on its own root.
 *
 * Order matters. Default-mode params clear the same keys from every other
 * mode, so the default set has to be applied first.
 */
const theme = themeQuartz
  .withParams({
    ...palette(LIGHT),
    borderRadius: "var(--radius, 0.625rem)",
    browserColorScheme: "light",
    fontFamily: FONT_STACK,
    // The grid is its own card. It used to be borderless because the host drew
    // a panel around it, which read as a card inside a card: two rounded
    // borders and a ring of padding between them, around one table.
    wrapperBorder: true,
    wrapperBorderRadius: "var(--radius, 0.625rem)",
  })
  .withParams({ ...palette(DARK), browserColorScheme: "dark" }, "dark");

function formatCellValue(value: LeaderboardItem[keyof LeaderboardItem]) {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Watches the element the grid is rendered into.
 *
 * A media query would answer the wrong question: the grid is as wide as the
 * column it is placed in, not as wide as the window, and a leaderboard sits in
 * a page column, a dashboard tile, or a phone. `undefined` until the observer
 * first fires, which is one frame, and the wide layout is the safe default for
 * that frame because it is the one that scrolls rather than clips.
 */
function useContainerWidth() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number>();

  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function Leaderboard({ def }: LeaderboardProps) {
  const isDark = useHostDarkMode();
  const [containerRef, containerWidth] = useContainerWidth();
  const result = z.safeParse(
    propsSchema as z.ZodType<ParsedLeaderboardDef>,
    def,
  );
  if (!result.success)
    throw new Error(
      `Error: ${z.prettifyError(result.error)}\nReceived: ${JSON.stringify(def, null, 2)}`,
    );

  const leaderboard = result.data;

  // Pinning rank and competitor keeps who a row belongs to on screen while the
  // scores scroll, but only while they are a small part of the width. On a
  // phone the two of them filled all but 80px of the grid, leaving a letterbox
  // to read every score through. Under this width the table scrolls whole.
  const narrow = containerWidth !== undefined && containerWidth < 640;

  const columnDefs = leaderboard.shape.map<ColDef<LeaderboardItem>>(
    (shapeItem, index) => {
      const pinned = !narrow && index < 2;

      return {
        field: shapeItem.id,
        headerName: shapeItem.name,
        // A number column holds a score or a duration, so it needs room for a
        // heading and little else. Giving it the same floor as a name column
        // pushed a board with four component scores into a horizontal scroll
        // on a desktop that had the width for all of them.
        minWidth:
          index === 0 ? 110
          : shapeItem.kind === "number" ? 120
          : 160,
        // A pinned column cannot flex, so it needs a width of its own or it
        // takes AG Grid's default 200: as much for a one digit rank as for a
        // full name. Sized to what they hold, and the slack goes to the scores.
        width:
          index === 0 ? 110
          : pinned ? 260
          : undefined,
        // Flex belongs to the scrolling columns. It used to sit on the second
        // one, which is pinned, and AG Grid ignores flex on a pinned column, so
        // a four column board stopped short of the right edge and left a third
        // of the table empty. Sharing the slack between the unpinned columns
        // fills the width, and `minWidth` still wins when there are too many
        // columns to fit.
        //
        // `null`, not `undefined`. Pinning and flex are state as well as
        // configuration, and on an update AG Grid reads `undefined` as "leave
        // it as it is", so a grid that narrowed past the breakpoint kept the
        // pinned columns it was told to drop. `null` is the way to say none.
        flex: pinned || index === 0 ? null : 1,
        pinned: pinned ? ("left" as const) : null,
        sort: index === 0 ? "asc" : undefined,
        cellDataType:
          shapeItem.kind === "number" ? "number"
          : shapeItem.kind === "boolean" ? "boolean"
          : "text",
        valueFormatter: ({ value }) => formatCellValue(value),
      };
    },
  );

  return (
    <div
      ref={containerRef}
      // The mode attribute has to sit on an ancestor of the grid and inside the
      // same tree: AG Grid scopes its dark params with a descendant selector,
      // and a selector in a shadow tree cannot see the `dark` class on <html>.
      data-ag-theme-mode={isDark ? "dark" : undefined}
      style={{
        color: `var(--foreground, ${(isDark ? DARK : LIGHT).foreground})`,
        fontFamily: FONT_STACK,
      }}
    >
      {/* No heading here. The board's name and description belong to whatever
          is placing this grid. The UI service prints them above every
          leaderboard it renders, and printing them again put the same two
          lines on the page twice. */}
      <AgGridProvider modules={[AllCommunityModule]}>
        <AgGridReact<LeaderboardItem>
          theme={theme}
          rowData={[...leaderboard.items]}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows
          pagination
          // A page size the selector also offers. Sizing it to the row count
          // put a number in the control that was not one of its options, and AG
          // Grid rendered the "Page Size" dropdown blank rather than pick for
          // you. Ten is only a ceiling now that the grid sizes to its rows.
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
          // Height follows the rows, capped by the page size. A fixed 420px
          // left a five row board two thirds empty, and stacking several of
          // those on one page turned the void into most of the scroll.
          domLayout="autoHeight"
          overlayNoRowsTemplate="No leaderboard items yet."
        />
      </AgGridProvider>
    </div>
  );
}

export default {
  component: Leaderboard,
  path: import.meta.path,
} satisfies ComponentDef<LeaderboardProps>;
