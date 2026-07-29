/**
 * When a track accepts submissions.
 *
 * Deliberately free of imports. The server enforces the window and the browser
 * renders it, and both need the same answer to "is this open?" — a shared module
 * is the only way that stays true. Anything importing `effect` here would land in
 * the client bundle, so the schema that parses these fields lives in `./schema`
 * instead, and this file holds only the reasoning about them.
 */

/** The part of a track's config that decides whether it takes submissions. */
export type SubmissionWindow = {
  readonly opensAt?: string | undefined;
  readonly closesAt?: string | undefined;
};

export type WindowState =
  | { readonly status: "open" }
  | { readonly status: "upcoming"; readonly opensAt: string }
  | { readonly status: "closed"; readonly closesAt: string };

/**
 * Where `now` sits relative to a window.
 *
 * The two bounds are optional and independent, so a track with neither is always
 * open — which is what every config written before these fields existed means.
 * `opensAt` is inclusive and `closesAt` exclusive: a deadline of 09:00:00 makes
 * 09:00:00.000 late, which is the reading a competitor is least likely to feel
 * cheated by.
 */
export const windowStateAt = (
  window: SubmissionWindow,
  now: number,
): WindowState => {
  if (window.opensAt && now < Date.parse(window.opensAt)) {
    return { status: "upcoming", opensAt: window.opensAt };
  }
  if (window.closesAt && now >= Date.parse(window.closesAt)) {
    return { status: "closed", closesAt: window.closesAt };
  }
  return { status: "open" };
};

export const isOpenAt = (window: SubmissionWindow, now: number) =>
  windowStateAt(window, now).status === "open";

/**
 * One phrasing of a window, so the rejection a competitor gets from the API and
 * the notice they read in the UI cannot drift apart.
 *
 * Timestamps are rendered in the reader's own timezone. A deadline shown in the
 * organiser's timezone is how people miss deadlines.
 */
export const describeWindowState = (state: WindowState) => {
  switch (state.status) {
    case "upcoming":
      return `This track does not open for submissions until ${formatInstant(state.opensAt)}.`;
    case "closed":
      return `This track closed for submissions on ${formatInstant(state.closesAt)}.`;
    case "open":
      return "This track is open for submissions.";
  }
};

export const formatInstant = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  // Spelled out field by field rather than with `dateStyle`/`timeStyle`, which
  // throw outright when combined with `timeZoneName`. The zone is the one part
  // that cannot be dropped: a deadline read in the wrong timezone is missed.
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
};
