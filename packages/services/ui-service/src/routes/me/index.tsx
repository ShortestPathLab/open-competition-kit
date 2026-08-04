import { MePageHeader } from "@/components/me-page-header";
import { EnrolmentsPanel } from "@/components/me-overview/enrolments-panel";
import { SignedOut } from "@/components/me-overview/signed-out";
import { SubmissionsPanel } from "@/components/me-overview/submissions-panel";
import { HeaderStats, PageBody } from "@/components/page-header-band";
import { ListSkeleton } from "@/components/skeletons";
import { Stat } from "@/components/stat-strip";
import { SurfaceSlot } from "@/components/surface-slot";
import { Button } from "@/components/ui/button";
import { useMeOverview } from "@/lib/me-overview-fn";
import { surface } from "@open-competition-kit/sdk/surface";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/me/")({
  component: MeIndexPage,
});

function MeIndexPage() {
  const { signedIn, loading, enrolments, submissions, stats } = useMeOverview();
  const ready = signedIn && !loading;

  return (
    <>
      <MePageHeader
        // The area is named in the breadcrumb, so the title names the page, the
        // way every section under it does. Titling this one "Your competitions"
        // as well made the two lines say the same thing twice, and it left the
        // breadcrumb stopping a step short of every sibling's.
        title="Overview"
        description="Everything you have entered, in one place."
        actions={
          <Button
            size="lg"
            className="h-10 px-5"
            render={<Link to="/competitions" />}
          >
            Browse competitions
            <ArrowRight />
          </Button>
        }
        // Only once there is a signed-in reader for these to be about. Signed
        // out, a strip of zeroes reads as an empty account rather than as a
        // prompt to sign in.
        meta={
          ready ?
            <HeaderStats>
              <Stat label="Competitions" value={stats.competitions} />
              <Stat label="Enrolled tracks" value={stats.tracks} />
              <Stat label="Submissions" value={stats.submissions} />
              <Stat
                label="Closing soon"
                value={stats.closing}
                emphasis={stats.closing > 0}
              />
            </HeaderStats>
          : undefined
        }
        tabs
      />

      <PageBody className="space-y-6">
        {/* Above the two lists, and only for a signed-in reader: an account-wide
            note from a package is about the reader, and the lists below are only
            the parts of that the product happens to know about. */}
        {ready ?
          <SurfaceSlot
            surface={surface.std.meOverview}
            subject={{}}
            layout="inline"
          />
        : null}

        {loading ?
          <ListSkeleton aria-label="Loading your competitions..." />
        : !signedIn ?
          <SignedOut />
        : <div className="grid gap-6 xl:grid-cols-2">
            <EnrolmentsPanel enrolments={enrolments} />
            <SubmissionsPanel submissions={submissions} />
          </div>
        }
      </PageBody>
    </>
  );
}
