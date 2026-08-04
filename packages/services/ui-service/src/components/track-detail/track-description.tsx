import { CompetitionIcon } from "@/components/entity-icon";
import type { CompetitionSummary } from "@/lib/competition-data";
import { Link } from "@tanstack/react-router";

/**
 * The competition gets a line of its own under the track's name.
 *
 * The breadcrumb says how you got here; this says what the track is part of,
 * and it is worth a second glance on the way in.
 */
export function TrackDescription({
  competitionId,
  competition,
  description,
}: {
  competitionId: string;
  competition: CompetitionSummary | undefined;
  description: string;
}) {
  return (
    <>
      <Link
        to="/competitions/$id"
        params={{ id: competitionId }}
        className="flex w-fit items-center gap-2 font-medium text-foreground hover:text-primary"
      >
        {/* Held empty until the name arrives rather than seeded with a
            placeholder, which would draw one avatar and then replace it with a
            different one. */}
        {competition ?
          <CompetitionIcon
            name={competition.name}
            icon={competition.icon}
            className="size-5 rounded"
          />
        : <span className="size-5 shrink-0 rounded bg-muted" />}
        {competition?.name}
      </Link>
      <span className="mt-1.5 block">{description}</span>
    </>
  );
}
