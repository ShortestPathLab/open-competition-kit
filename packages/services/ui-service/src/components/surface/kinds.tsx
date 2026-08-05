import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SurfaceAction, SurfaceItem, SurfaceNote } from "@open-competition-kit/sdk/surface";
import { BUTTON_VARIANTS, ICONS, NOTE_TITLE_TONES, NOTE_TONES, STEP_DOTS } from "./tokens";

/**
 * A contributed link. A plain anchor either way: an internal href is rare, and
 * the router's `Link` wants a route it can prove exists, which a string from a
 * package is not.
 */
export function ActionButton({ action, full }: { action: SurfaceAction; full?: boolean }) {
  const Icon = action.icon ? ICONS[action.icon] : undefined;

  return (
    <Button
      size="sm"
      variant={BUTTON_VARIANTS[action.style ?? "secondary"]}
      className={cn(full && "w-full")}
      render={
        <a
          href={action.href}
          {...(action.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
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
 * contributed note and the fallback a `component` item carries, and a fallback has
 * no id of its own to be keyed or suppressed by.
 */
export function Note({
  note,
  full,
}: {
  note: Omit<SurfaceNote, "kind" | "id" | "weight">;
  full?: boolean;
}) {
  const tone = note.tone ?? "info";

  return (
    <div className={cn("rounded-xl border p-4", NOTE_TONES[tone])}>
      {note.title ? (
        <p className={cn("text-sm font-semibold", NOTE_TITLE_TONES[tone])}>{note.title}</p>
      ) : null}
      {note.body ? (
        <div
          className={cn(
            "prose prose-sm max-w-none text-muted-foreground dark:prose-invert",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:before:content-none [&_code]:after:content-none",
            note.title && "mt-1",
          )}
        >
          <Markdown remarkPlugins={[remarkGfm]}>{note.body}</Markdown>
        </div>
      ) : null}
      {note.actions?.length ? (
        <div className={cn("mt-3 flex flex-wrap gap-2", full && "flex-col")}>
          {note.actions.map((action, index) => (
            <ActionButton key={`${action.href}-${index}`} action={action} full={full} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A label and a value, shaped like the boxes in the competition rail. */
export function Fact({
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
      {href ? (
        <a
          className="truncate text-sm font-medium underline-offset-4 hover:underline"
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        >
          {value}
        </a>
      ) : (
        <span className="truncate text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

/**
 * A command, with a way to take it. The copy button is why this is its own kind
 * rather than a fenced block inside a note: nobody retypes a clone URL, and
 * selecting one out of prose on a phone is a small misery.
 */
export function Code({
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
          {copied ? (
            <>
              <Check /> Copied
            </>
          ) : (
            <>
              <Copy /> Copy
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-terminal px-3 py-2.5 text-xs text-terminal-foreground">
        <code>{body}</code>
      </pre>
    </div>
  );
}

export function Checklist({
  title,
  steps,
}: {
  title?: string;
  steps: Extract<SurfaceItem, { kind: "checklist" }>["steps"];
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      {title ? <p className="mb-2.5 text-sm font-semibold">{title}</p> : null}
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
              {step.detail ? (
                <span className="block text-xs text-muted-foreground">{step.detail}</span>
              ) : null}
              {step.action ? (
                <span className="mt-1.5 block">
                  <ActionButton action={{ style: "link", ...step.action }} />
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
