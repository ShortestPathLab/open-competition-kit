import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { type ReactNode } from "react";
import { AdminCompetitionTabs } from "@/components/admin-competition-tabs";
import { CompetitionSelector } from "@/components/competition-selector";
import { PageHeaderBand } from "@/components/page-header-band";

/** The section a page below the four sits under. */
export type AdminParent = {
  label: string;
  section: "overview" | "participants" | "submissions" | "settings";
};

const SECTION_ROUTES = {
  overview: "/dashboard/$competitionId/overview",
  participants: "/dashboard/$competitionId/participants",
  submissions: "/dashboard/$competitionId/submissions",
  settings: "/dashboard/$competitionId/settings",
} as const;

interface AdminPageHeaderProps {
  competitionId: string;
  /** Absent while the competition is still loading, which is why it is optional. */
  competitionName?: string;
  title: ReactNode;
  /**
   * Where this page sits, for pages below a section.
   *
   * One step, not a trail. Nothing in the dashboard is more than one level below
   * a section, and the way out of a participant is back to the participants.
   */
  back?: AdminParent;
  description?: ReactNode;
  /** Right-aligned controls. Header buttons are `size="lg"` with `h-10 px-5`. */
  actions?: ReactNode;
  meta?: ReactNode;
  media?: ReactNode;
  /**
   * Whether to carry the dashboard's section tabs beside the competition picker.
   *
   * On for the four sections, off for anything below them. The same argument the
   * competition and personal areas make: one participant is somewhere you went
   * to, and a tab strip there offers to move you sideways out of what you were
   * reading. `back` is what takes you out. The picker stays either way, since
   * which competition you are looking at is true on every page.
   */
  tabs?: boolean;
  className?: string;
}

/**
 * The header band for a page in the organiser dashboard.
 *
 * The same band the competition and personal areas use, so all three read as one
 * product: the title belongs to the page rather than to whatever contains it,
 * and the stats close the band off along its bottom edge. What the dashboard
 * keeps of its own is the row above the title, where the competition picker and
 * the section tabs sit on one line. Which competition you are organising and
 * which of its sections you are in is one thought, and splitting it across a
 * trail and a tab strip made it read as two.
 *
 * No breadcrumb, unlike the other two areas. A dashboard is somewhere an
 * organiser stays rather than passes through, and the picker and the tabs
 * already say where they are: a trail reading Dashboard, Participants, Ada would
 * be a third answer to a question nobody asked twice. What is worth having is
 * the way out of a page below a section, and that is one link with one place to
 * go, so it is a back button rather than a path.
 */
export function AdminPageHeader({
  competitionId,
  competitionName,
  title,
  back,
  description,
  actions,
  meta,
  media,
  tabs = false,
  className,
}: AdminPageHeaderProps) {
  return (
    <PageHeaderBand
      className={className}
      title={title}
      description={description}
      actions={actions}
      meta={meta}
      media={media}
      breadcrumb={
        back ? (
          <Link
            to={SECTION_ROUTES[back.section]}
            params={{ competitionId }}
            className="-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        ) : undefined
      }
      nav={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CompetitionSelector
            competitionId={competitionId}
            // A space rather than a fallback name, so the row holds its height
            // while the competition loads and nothing below it jumps once the
            // name arrives.
            name={competitionName ?? " "}
          />
          {tabs ?
            <AdminCompetitionTabs competitionId={competitionId} />
          : null}
        </div>
      }
    />
  );
}
