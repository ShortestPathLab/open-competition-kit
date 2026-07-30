import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { Button } from "*/components/ui/button";
import { cn } from "*/lib/utils";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  Info,
  Terminal,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  Subject,
  SurfaceAction,
  SurfaceContext,
  SurfaceItem,
  SurfaceNote,
} from "@open-competition-kit/sdk/surface";
import { useKitComponent } from "src/hooks/use-kit-component";
import { authClient } from "src/lib/auth-client";
import { useSurface } from "src/lib/surface-fn";

/**
 * Where an installed package gets to speak.
 *
 * A page names a region and what it is about; what appears there depends on
 * which packages the organiser installed. Nothing here knows about GitHub, and
 * the integration that does knows nothing about panels, which is the whole point
 * of the arrangement.
 *
 * Everything is drawn with the app's own primitives rather than handed to the
 * package to draw. A note contributed by an integration should be
 * indistinguishable from one the product wrote, and it costs no bundle to make
 * it so.
 */

/**
 * Icon names a contribution may ask for.
 *
 * An unknown name draws nothing. That way a package can name an icon a newer
 * host has without an older one rendering a broken box where the glyph goes.
 */
const ICONS: Record<string, LucideIcon> = {
  github: Github,
  external: ExternalLink,
  book: BookOpen,
  branch: GitBranch,
  terminal: Terminal,
  upload: Upload,
  download: Download,
  info: Info,
};

const NOTE_TONES = {
  info: "border-border bg-muted/40",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-destructive/30 bg-destructive/5",
} as const;

const NOTE_TITLE_TONES = {
  info: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
} as const;

const STEP_DOTS = {
  ok: "bg-success",
  pending: "bg-warning",
  blocked: "bg-destructive",
} as const;

const BUTTON_VARIANTS = {
  primary: "default",
  secondary: "outline",
  link: "link",
} as const;

/**
 * A contributed link.
 *
 * A plain anchor either way. An internal href is rare (a package links to
 * something it owns, which is usually elsewhere) and the router's `Link` wants a
 * route it can prove exists, which a string from a package is not.
 */
function ActionButton({
  action,
  full,
}: {
  action: SurfaceAction;
  full?: boolean;
}) {
  const Icon = action.icon ? ICONS[action.icon] : undefined;

  return (
    <Button
      size="sm"
      variant={BUTTON_VARIANTS[action.style ?? "secondary"]}
      className={cn(full && "w-full")}
      render={
        <a
          href={action.href}
          {...(action.external ?
            { target: "_blank", rel: "noreferrer noopener" }
          : {})}
        />
      }
    >
      {Icon ? <Icon /> : null}
      {action.label}
      {action.external && !Icon ? <ExternalLink /> : null}
    </Button>
  );
}

/**
 * Takes the note's content without its identity: the same renderer draws a
 * contributed note and the fallback a `component` item carries, and a fallback
 * has no id of its own to be keyed or suppressed by.
 */
function Note({
  note,
  full,
}: {
  note: Omit<SurfaceNote, "kind" | "id" | "weight">;
  full?: boolean;
}) {
  const tone = note.tone ?? "info";

  return (
    <div className={cn("rounded-xl border p-4", NOTE_TONES[tone])}>
      {note.title ?
        <p className={cn("text-sm font-semibold", NOTE_TITLE_TONES[tone])}>
          {note.title}
        </p>
      : null}
      {note.body ?
        <div
          className={cn(
            "prose prose-sm max-w-none text-muted-foreground dark:prose-invert",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:before:content-none [&_code]:after:content-none",
            note.title && "mt-1",
          )}
        >
          <Markdown remarkPlugins={[remarkGfm]}>{note.body}</Markdown>
        </div>
      : null}
      {note.actions?.length ?
        <div className={cn("mt-3 flex flex-wrap gap-2", full && "flex-col")}>
          {note.actions.map((action, index) => (
            <ActionButton
              key={`${action.href}-${index}`}
              action={action}
              full={full}
            />
          ))}
        </div>
      : null}
    </div>
  );
}

/** A label and a value, shaped like the boxes in the competition rail. */
function Fact({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-secondary px-3 py-2.5">
      <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {href ?
        <a
          className="truncate text-sm font-medium underline-offset-4 hover:underline"
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        >
          {value}
        </a>
      : <span className="truncate text-sm font-medium">{value}</span>}
    </div>
  );
}

/**
 * A command, with a way to take it.
 *
 * The copy button is the reason this is its own kind rather than a fenced block
 * inside a note: nobody retypes a clone URL, and selecting one out of prose on a
 * phone is a small misery.
 */
function Code({
  title,
  language,
  body,
}: {
  title?: string;
  language?: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {title ?? language ?? "Command"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1.5 px-2 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(body).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              // A denied clipboard is the browser's call, not an error worth
              // showing. The text is on screen either way.
              () => undefined,
            );
          }}
        >
          {copied ?
            <>
              <Check /> Copied
            </>
          : <>
              <Copy /> Copy
            </>
          }
        </Button>
      </div>
      <pre className="overflow-x-auto bg-terminal px-3 py-2.5 text-xs text-terminal-foreground">
        <code>{body}</code>
      </pre>
    </div>
  );
}

function Checklist({
  title,
  steps,
}: {
  title?: string;
  steps: Extract<SurfaceItem, { kind: "checklist" }>["steps"];
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      {title ?
        <p className="mb-2.5 text-sm font-semibold">{title}</p>
      : null}
      <ul className="flex flex-col gap-2.5">
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                STEP_DOTS[step.state],
                step.state === "pending" && "motion-safe:animate-pulse",
              )}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{step.label}</span>
              {step.detail ?
                <span className="block text-xs text-muted-foreground">
                  {step.detail}
                </span>
              : null}
              {step.action ?
                <span className="mt-1.5 block">
                  <ActionButton
                    action={{ style: "link", ...step.action }}
                  />
                </span>
              : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A package's own renderer, for content the data kinds cannot hold.
 *
 * Bundled, evaluated in the browser and mounted in a shadow root, so it pays for
 * itself only when the content is interactive or live. A failure lands as the
 * item's fallback rather than as a spinner that never resolves, because the build
 * step and the boundary are two more things that can go wrong on a machine the
 * organiser owns and we do not.
 */
function View({
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
    return item.fallback ?
        <Note note={item.fallback} />
      : null;
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
