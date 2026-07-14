/**
 * Renderers are mounted inside a shadow root with no global stylesheet, so a
 * chart cannot inherit theme tokens from the host page — it has to carry its own.
 *
 * The categorical slots below are assigned in fixed order and never cycled. Both
 * columns are validated as a set against their own surface (light: worst adjacent
 * CVD ΔE 24.2; dark: 10.3, the floor band — which is why every multi-series chart
 * ships a legend and a 2px surface gap between marks as secondary encoding).
 */
export type Theme = {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  grid: string;
  border: string;
  series: string[];
};

export const light: Theme = {
  surface: "#fcfcfb",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  grid: "#e6e5e1",
  border: "#d9d8d3",
  series: [
    "#2a78d6",
    "#1baf7a",
    "#eda100",
    "#008300",
    "#4a3aa7",
    "#e34948",
    "#e87ba4",
    "#eb6834",
  ],
};

export const dark: Theme = {
  surface: "#1a1a19",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  grid: "#33322f",
  border: "#3d3c38",
  series: [
    "#3987e5",
    "#199e70",
    "#c98500",
    "#008300",
    "#9085e9",
    "#e66767",
    "#d55181",
    "#d95926",
  ],
};

/** Colour follows the entity's slot, never its rank, so filtering never repaints. */
export const seriesColour = (theme: Theme, index: number) =>
  theme.series[index % theme.series.length]!;
