import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CompetitionTabs } from "@/components/competition-tabs";
import { PageHeaderBand } from "@/components/page-header-band";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { useHasBanner } from "@/lib/banner";

/** One step between the competition and the page you are on. */
export type Crumb = {
  label: string;
  /** A section within this competition, e.g. `tracks` or `leaderboards`. */
  section: "tracks" | "leaderboards" | "submissions" | "rules";
};

const SECTION_ROUTES = {
  tracks: "/competitions/$id/tracks",
  leaderboards: "/competitions/$id/leaderboards",
  submissions: "/competitions/$id/submissions",
  rules: "/competitions/$id/rules",
} as const;

interface CompetitionPageHeaderProps {
  competitionId: string;
  /** Absent while the competition is still loading, which is why it is optional. */
  competitionName?: string;
  /**
   * Leading visual, left of the title block. Reserved for a page whose subject is
   * a thing rather than a view of one: a track has an avatar, a list of tracks
   * does not.
   */
  media?: ReactNode;
  title: ReactNode;
  /** The bold final breadcrumb. Defaults to `title`, which is only usable when it is a string. */
  crumb?: string;
  /** Steps between the competition and this page. Usually zero or one. */
  trail?: Crumb[];
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  /**
   * Whether to carry the competition's section tabs under the breadcrumb.
   *
   * On for the five section pages, off for anything below them. A track, a
   * submission form or an enrolment is a place you went *to*, and a tab strip
   * on those pages offers to move you sideways out of a task you are in the
   * middle of. The breadcrumb is what takes you back out.
   */
  tabs?: boolean;
  className?: string;
}

/**
 * The header band for a page inside a competition.
 *
 * The competition is named in the breadcrumb and nowhere else, so the title can
 * belong to the page. Every page under `/competitions/$id` used to inherit one
 * shared header announcing the competition, which left a leaderboard and a
 * submission form looking identical down to the call to action.
 */
export function CompetitionPageHeader({
  competitionId,
  competitionName,
  title,
  crumb,
  trail = [],
  description,
  actions,
  meta,
  media,
  tabs = false,
  className,
}: CompetitionPageHeaderProps) {
  const current = crumb ?? (typeof title === "string" ? title : undefined);
  // The navbar asks the router the same question and gets the same answer, so
  // the two halves of the chrome always agree without anything passing between
  // them. The image itself comes from the shell, which both inherit.
  const banner = useHasBanner();

  return (
    <PageHeaderBand
      banner={banner}
      className={className}
      title={title}
      description={description}
      actions={actions}
      meta={meta}
      media={media}
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/competitions" />}>Competitions</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<Link to="/competitions/$id" params={{ id: competitionId }} />}
              >
                {/* A space rather than a fallback name: the crumb holds its
                    height while the competition loads, so the title below it
                    does not jump once the name arrives. */}
                {competitionName ?? " "}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {trail.map((step) => (
              <Fragment key={step.section}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={
                      <Link to={SECTION_ROUTES[step.section]} params={{ id: competitionId }} />
                    }
                  >
                    {step.label}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </Fragment>
            ))}
            {current ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{current}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      }
      nav={tabs ? <CompetitionTabs competitionId={competitionId} /> : undefined}
    />
  );
}
