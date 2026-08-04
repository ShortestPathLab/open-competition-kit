import { cn } from "*/lib/utils";
import type {
  Subject,
  SurfaceContext,
  SurfaceItem,
} from "@open-competition-kit/sdk/surface";
import { authClient } from "src/lib/auth-client";
import { useSurface } from "src/lib/surface-fn";
import {
  ActionButton,
  Checklist,
  Code,
  Fact,
  Note,
} from "./surface/kinds";
import { View } from "./surface/view";

/**
 * Where an installed package gets to speak.
 *
 * A page names a region and what it is about; what appears there depends on which
 * packages the organiser installed. Nothing here knows about GitHub, and the
 * integration that does knows nothing about panels, which is the point of the
 * arrangement.
 *
 * Everything is drawn with the app's own primitives rather than handed to the
 * package to draw. A note contributed by an integration should be
 * indistinguishable from one the product wrote, and it costs no bundle to make it
 * so.
 */
function Item({
  item,
  context,
  full,
}: {
  item: SurfaceItem;
  context: SurfaceContext;
  full: boolean;
}) {
  switch (item.kind) {
    case "note":
      return <Note note={item} full={full} />;
    case "fact":
      return (
        <Fact
          label={item.label}
          value={item.value}
          href={item.href}
          external={item.external}
        />
      );
    case "code":
      return (
        <Code title={item.title} language={item.language} body={item.body} />
      );
    case "checklist":
      return <Checklist title={item.title} steps={item.steps} />;
    // `chrome: "panel"` is what a package asks for when it only wants the inside
    // of a card. Without it every integration would draw its own, and a rail of
    // four packages would look like four different products. `View` applies it,
    // because only it knows whether there is anything to put inside.
    case "component":
      return <View item={item} context={context} />;
    // Actions are grouped by the caller so a run of them shares one row.
    case "action":
      return <ActionButton action={item} full={full} />;
  }
}

/**
 * Consecutive actions, as one row.
 *
 * Two packages each contributing a button should read as a row of buttons rather
 * than a column of them, and grouping is the only way to know which are adjacent
 * once weights have been applied.
 */
type Run =
  | { actions: Extract<SurfaceItem, { kind: "action" }>[]; item?: never }
  | { item: SurfaceItem; actions?: never };

function runsOf(items: readonly SurfaceItem[]): Run[] {
  const runs: Run[] = [];

  for (const item of items) {
    if (item.kind !== "action") {
      runs.push({ item });
      continue;
    }
    const last = runs.at(-1);
    if (last?.actions) last.actions.push(item);
    else runs.push({ actions: [item] });
  }

  return runs;
}

export function SurfaceSlot({
  surface,
  subject,
  /**
   * `stack` fills the width, for a rail. `inline` lets buttons size to their
   * label, for a page body where a full-width button would look like a mistake.
   */
  layout = "stack",
  className,
}: {
  surface: string;
  subject: Subject;
  layout?: "stack" | "inline";
  className?: string;
}) {
  const { data: session } = authClient.useSession();
  const { data } = useSurface(surface, subject, session?.user?.id);

  // Nothing while it loads, and nothing when there is nothing. Most regions in
  // most competitions have no contributions at all, so a skeleton here would
  // promise content to every reader and deliver it to almost none.
  if (!data?.items.length) return null;

  const full = layout === "stack";
  const context = data.context;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {runsOf(data.items).map((run, index) =>
        run.actions ?
          <div
            key={`actions-${index}`}
            className={cn("flex gap-2", full ? "flex-col" : "flex-wrap")}
          >
            {run.actions.map((action) => (
              <Item
                key={action.id}
                item={action}
                context={context}
                full={full}
              />
            ))}
          </div>
        : <Item
            key={run.item.id}
            item={run.item}
            context={context}
            full={full}
          />,
      )}
    </div>
  );
}
