import { CompetitionPageHeader } from "@/components/competition-page-header";
import { CompetitionIcon } from "@/components/entity-icon";
import { HeaderStats } from "@/components/page-header-band";
import { Stat } from "@/components/stat-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompetitionSummary } from "@/lib/competition-data";
import { useIsAdmin } from "@/lib/use-admin";
import { isDraft } from "@open-competition-kit/sdk/visibility";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, PencilRuler } from "lucide-react";
import { TrackPickerPopover } from "./track-picker-popover";

/**
 * The one page whose subject is the competition itself, so it keeps the full
 * hero: the title is the competition's name rather than the page's. The
 * breadcrumb still ends on "Overview", so this page names itself there the way
 * each of its siblings does.
 */
export function OverviewHeader({
  competitionId,
  competition,
  leaderboardCount,
  enrolmentCount,
  submissionCount,
}: {
  competitionId: string;
  competition: CompetitionSummary;
  leaderboardCount: number;
  enrolmentCount: number;
  submissionCount: number;
}) {
  const isAdmin = useIsAdmin();

  return (
    <CompetitionPageHeader
      competitionId={competitionId}
      competitionName={competition.name}
      crumb="Overview"
      media={
        <CompetitionIcon
          name={competition.name}
          icon={competition.icon}
          className="hidden size-16 rounded-xl sm:block"
        />
      }
      title={
        <span className="flex flex-wrap items-center gap-3">
          {competition.name}
          {/* Only an organiser is ever handed a draft, so this doubles as a
              reminder that nobody else can reach this page. */}
          {isDraft(competition) ? (
            <Badge variant="secondary">
              <PencilRuler />
              Draft, visible only to organisers
            </Badge>
          ) : null}
        </span>
      }
      description={
        <>
          <span className="block text-foreground">{competition.organiser}</span>
          <span className="mt-1.5 block">{competition.description}</span>
        </>
      }
      actions={
        <>
          <TrackPickerPopover competitionId={competitionId} tracks={competition.tracks} />
          <Button
            size="lg"
            className="h-10 px-5"
            variant="outline"
            render={<Link to="/competitions/$id/rules" params={{ id: competitionId }} />}
          >
            Read the rules
          </Button>
          {/* The other half of "View as competitor". An organiser checking how
              their competition reads arrives here and has no way back into the
              thing they were editing, which is a page reload and a menu away. */}
          {isAdmin ? (
            <Button
              size="lg"
              className="h-10 px-5"
              variant="outline"
              render={<Link to="/dashboard/$competitionId/overview" params={{ competitionId }} />}
            >
              View as organiser
              <ArrowUpRight className="size-4" />
            </Button>
          ) : null}
        </>
      }
      // Panels rather than the inline meta row the section pages use. This is
      // the competition's front page, and these are the numbers that describe
      // it, so they get the room to be read at a glance.
      meta={
        <HeaderStats>
          {/* What the competition offers first, then what has happened in it,
              in the order it happens: you enter, then you submit. */}
          <Stat label="Tracks" value={competition.tracks.length} />
          <Stat label="Leaderboards" value={leaderboardCount} />
          <Stat label="Enrolments" value={enrolmentCount} />
          <Stat label="Submissions" value={submissionCount} />
        </HeaderStats>
      }
      tabs
    />
  );
}
