import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import type {
  SurfaceContext,
  SurfaceItem,
} from "@open-competition-kit/sdk/surface";
import { useKitComponent } from "src/hooks/use-kit-component";
import { Note } from "./kinds";

/**
 * A package's own renderer, for content the data kinds cannot hold.
 *
 * Bundled, evaluated in the browser and mounted in a shadow root, so it pays for
 * itself only when the content is interactive or live. A failure lands as the
 * item's fallback rather than a spinner that never resolves, because the build
 * step and the boundary are two more things that can go wrong on a machine the
 * organiser owns and we do not.
 */
export function View({
  item,
  context,
}: {
  item: Extract<SurfaceItem, { kind: "component" }>;
  context: SurfaceContext;
}) {
  const { Component, isPending, isError } = useKitComponent("surface.view", {
    // The same node the content came from, so the package that contributed the
    // item is the one asked to draw it.
    accessor:
      context.subject.track ?
        { competitions: { tracks: context.subject.track } }
      : context.subject.competition ?
        { competitions: context.subject.competition }
      : true,
    args: { view: item.view },
  });

  if (isError) {
    // The fallback comes without the chrome. A tinted note reads as the second
    // choice it is, where the same sentence inside the panel the view asked for
    // would read as the thing itself.
    return item.fallback ? <Note note={item.fallback} /> : null;
  }

  if (isPending) return null;

  const view = <Component props={item.props ?? {}} context={context} />;

  // The chrome is decided here rather than around the call, so a view that is
  // still loading or gone does not leave an empty panel with a heading on it.
  return item.chrome === "panel" ?
      <Panel>
        {item.title ?
          <PanelHeader>
            <PanelTitle>{item.title}</PanelTitle>
          </PanelHeader>
        : null}
        <PanelBody>{view}</PanelBody>
      </Panel>
    : view;
}
