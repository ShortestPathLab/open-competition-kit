import { cn } from "@/lib/utils";
import { Fragment } from "react";
import type { JsonValue } from "@/lib/submission-fn";
import {
  formatResultValue,
  labelForKey,
  prettyJson,
} from "@/lib/submission-readout";

/**
 * Any JSON value, as rows rather than as a block of syntax.
 *
 * What a runner writes and what a form stores are both "some JSON", which is
 * why these pages used to print braces at people. An object, or an array of
 * them, reads here as labelled values; nesting becomes an indented group under
 * the name it arrived with.
 */

/** Below this, the indentation carries less than the text it replaced. */
const MAX_DEPTH = 3;

export function ValueTree({
  value,
  depth = 0,
  className,
}: {
  value: JsonValue;
  depth?: number;
  className?: string;
}) {
  if (value === null || typeof value !== "object") {
    return (
      <p className={cn("text-sm wrap-break-word", className)}>
        {formatResultValue(value)}
      </p>
    );
  }

  // Past a few levels the shape is the information, and a list of lists of
  // lists hides it where the JSON at least keeps it in one piece.
  if (depth >= MAX_DEPTH) {
    return (
      <pre
        className={cn(
          "overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap",
          className,
        )}
      >
        {prettyJson(value)}
      </pre>
    );
  }

  const isList = Array.isArray(value);
  const entries: [string, JsonValue][] =
    isList ?
      value.map((entry, index) => [String(index + 1), entry])
    : Object.entries(value);

  if (entries.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {isList ? "Nothing in this list" : "Nothing recorded"}
      </p>
    );
  }

  return (
    <dl
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5",
        className,
      )}
    >
      {entries.map(([key, entry]) => {
        const label = isList ? key : labelForKey(key);

        // A scalar sits beside its name. Anything else gets the name as a
        // heading and its own indented block, so two levels never read as one
        // flat list of unrelated pairs.
        if (entry === null || typeof entry !== "object") {
          return (
            <Fragment key={key}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm wrap-break-word">
                {formatResultValue(entry)}
              </dd>
            </Fragment>
          );
        }

        return (
          <Fragment key={key}>
            <dt className="col-span-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </dt>
            <dd className="col-span-2 border-l border-border pl-3">
              <ValueTree value={entry} depth={depth + 1} />
            </dd>
          </Fragment>
        );
      })}
    </dl>
  );
}
