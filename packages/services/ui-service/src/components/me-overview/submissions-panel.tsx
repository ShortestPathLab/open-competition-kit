import { Button } from "@/components/ui/button";
import type { UserSubmissionSummary } from "@/lib/competition-data";
import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PanelEmpty, PreviewPanel } from "./preview-panel";

/** One more than the enrolments panel: these rows are a third of the height. */
const PREVIEW_COUNT = 5;

export function SubmissionsPanel({ submissions }: { submissions: UserSubmissionSummary[] }) {
  return (
    <PreviewPanel
      title="Submissions"
      seeAll={
        <Button variant="outline" size="sm" render={<Link to="/me/submissions" />}>
          See all
        </Button>
      }
    >
      {submissions.length === 0 ? (
        <PanelEmpty
          icon={<ClipboardList />}
          title="No submissions yet"
          description="Once you submit to a track, they will show up here."
        />
      ) : (
        <div className="space-y-3">
          {/* Newest first. The list arrives in creation order, which is the
              order the numbering counts in, so the reverse happens here rather
              than in the sort that produced the numbers. */}
          {[...submissions]
            .reverse()
            .slice(0, PREVIEW_COUNT)
            .map((submission) => (
              <Link
                key={submission.id}
                to="/me/submissions/$submissionId"
                params={{ submissionId: submission.id }}
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <p className="font-semibold">{submission.trackName}</p>
                <p className="text-sm text-muted-foreground">{submission.competitionName}</p>
                <p className="mt-2 text-xs text-muted-foreground">Submission {submission.number}</p>
              </Link>
            ))}
        </div>
      )}
    </PreviewPanel>
  );
}
