import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";

import { StatusScreen } from "@/components/status-screen";
import { Button } from "@/components/ui/button";

/**
 * `ErrorComponentProps` types the error as an `Error`, but a boundary catches
 * whatever was thrown, and a `throw "nope"` reaches here as a string.
 */
function readMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "No message came with the error.";
}

/**
 * The router's `defaultErrorComponent`: what every route falls back to when a
 * loader, a `beforeLoad` or a render throws.
 *
 * The message is shown in full because the ones that reach here are usually
 * actionable ("Unauthorized", a failed server function). The stack is not: it
 * names server paths and internals, so it stays behind the dev build.
 */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const stack = error instanceof Error ? error.stack : undefined;

  return (
    <StatusScreen
      code="Error"
      tone="destructive"
      title="This page didn't load"
      description="The page hit an error on its way in. Trying again usually clears it; if it doesn't, the message below says what went wrong."
      actions={
        <>
          <Button
            size="lg"
            className="h-10 px-5"
            onClick={() => {
              // `reset` clears the boundary, `invalidate` re-runs the loaders
              // that produced the error. Without the second one the boundary
              // just re-renders the same failed match.
              reset();
              void router.invalidate();
            }}
          >
            <RotateCcw />
            Try again
          </Button>
          <Button variant="outline" size="lg" className="h-10 px-5" render={<Link to="/" />}>
            Go home
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="max-h-48 overflow-auto font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
          {readMessage(error)}
        </p>
      </div>
      {import.meta.env.DEV && stack ? (
        <details className="mt-3 rounded-xl border border-border bg-muted/40 p-4">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Stack trace
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {stack}
          </pre>
        </details>
      ) : null}
    </StatusScreen>
  );
}
