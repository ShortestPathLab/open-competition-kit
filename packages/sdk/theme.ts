import * as React from "react";

/**
 * Browser-side theming helpers for kit components.
 *
 * A leaf module, like `./z`. A component is bundled for the browser, so it
 * cannot reach the SDK barrel: that pulls in Bun's shell and Effect's node
 * platform and fails the bundle.
 */

const QUERY = "(prefers-color-scheme: dark)";

/**
 * Whether the page around a kit component is in dark mode.
 *
 * Colour tokens need no help from this. Custom properties cross a shadow
 * boundary, so whatever the host set on `<html>` already reaches inside a
 * renderer. What does not cross is anything a *selector* has to see: a rule
 * inside a shadow tree cannot match an ancestor outside it, so a `dark:`
 * variant, or AG Grid's `[data-ag-theme-mode="dark"]`, finds nothing. A
 * renderer re-applies the signal to its own root to give those something local
 * to match.
 *
 * ui-service drives the page with next-themes in `attribute="class"` mode,
 * which writes `light` or `dark` onto `<html>`. That is the value to read, not
 * the media query: a reader who picks light on a dark-scheme machine wants
 * light, and the media query would say otherwise. The query is the fallback for
 * a host that sets no class at all.
 */
export function useHostDarkMode() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const root = globalThis.document?.documentElement;
    if (!root) return;

    const media = globalThis.matchMedia?.(QUERY);
    const read = () => {
      if (root.classList.contains("dark")) return true;
      if (root.classList.contains("light")) return false;
      return media?.matches ?? false;
    };
    const update = () => setIsDark(read());

    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    media?.addEventListener("change", update);

    return () => {
      observer.disconnect();
      media?.removeEventListener("change", update);
    };
  }, []);

  return isDark;
}
