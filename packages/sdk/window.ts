/**
 * A track's submission window, re-exported on its own path.
 *
 * The root `index.ts` pulls in the whole kit — database, hooks, esbuild — which
 * a browser bundle has no business carrying. This module reaches only for the
 * import-free reasoning about opening and closing times, so a client component
 * can ask whether a track is open without dragging the server in behind it.
 */
export * from "@open-competition-kit/core/config/window";
