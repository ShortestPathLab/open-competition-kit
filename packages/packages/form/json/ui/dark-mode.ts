import * as React from "react";

const QUERY = "(prefers-color-scheme: dark)";

/**
 * Whether the page around the form is in dark mode.
 *
 * The colour tokens themselves need no help: custom properties cross a shadow
 * boundary, so whatever the host set on `<html>` already reaches inside. The
 * `dark:` variants are the part that does not, because a selector inside a
 * shadow tree cannot see an ancestor outside it. The form re-applies the class
 * to its own root so those variants have something local to match.
 *
 * ui-service drives this with next-themes in `attribute="class"` mode, which
 * writes `light` or `dark` onto `<html>`. Reading the media query is the
 * fallback for a host that sets neither.
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
