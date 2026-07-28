import * as React from "react";

/**
 * Where floating UI (so far, the select popup) should render.
 *
 * Base UI portals to `document.body` by default. That is the wrong side of two
 * boundaries at once here: the stylesheet the form injects lives in its shadow
 * root, and the `dark` class that switches the palette lives on the form's own
 * root element. A popup in `document.body` inherits neither, so it comes out
 * correctly positioned and completely unstyled.
 *
 * The form points this at a container inside both, which costs nothing in
 * positioning: Base UI positions popups with `position: fixed`, and the
 * container shares every ancestor that could establish a containing block with
 * the shadow root itself.
 *
 * `null` means no container was provided, which is the right answer when the
 * form is rendered straight into the page. Base UI then uses its default.
 */
const PortalContainerContext =
  React.createContext<React.RefObject<HTMLElement | null> | null>(null);

export function PortalContainerProvider({
  value,
  children,
}: {
  value: React.RefObject<HTMLElement | null> | null;
  children: React.ReactNode;
}) {
  return (
    <PortalContainerContext.Provider value={value}>
      {children}
    </PortalContainerContext.Provider>
  );
}

export function usePortalContainer() {
  return React.useContext(PortalContainerContext);
}
