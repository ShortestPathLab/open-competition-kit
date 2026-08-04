import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { StatusScreen } from "@/components/status-screen";
import { Button } from "@/components/ui/button";

/**
 * What was missing, so the page can name it instead of saying "page" for a
 * track that never existed. Guards attach it with `notFound({ data })`.
 */
type NotFoundData = { subject?: string };

function readSubject(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { subject } = data as NotFoundData;
  return typeof subject === "string" && subject ? subject : undefined;
}

export type NotFoundPageProps = {
  /** Names the missing thing directly, when rendered as a plain component. */
  subject?: string;
  /** The router passes `notFound({ data })` through under this name. */
  data?: unknown;
};

/**
 * The router's `defaultNotFoundComponent`, and a component in its own right for
 * the handful of places that discover a missing record while rendering.
 */
export function NotFoundPage({ subject, data }: NotFoundPageProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const missing = subject ?? readSubject(data) ?? "page";

  return (
    <StatusScreen
      code="404"
      title={`We can't find that ${missing}`}
      description={
        <>
          There is nothing at{" "}
          <code className="font-mono break-all text-foreground">{pathname}</code>
          . The link may be out of date, or the {missing} may have been removed.
        </>
      }
      actions={
        <>
          <Button
            size="lg"
            className="h-10 px-5"
            render={<Link to="/competitions" />}
          >
            Browse competitions
            <ArrowRight />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10 px-5"
            render={<Link to="/" />}
          >
            Go home
          </Button>
        </>
      }
    />
  );
}
