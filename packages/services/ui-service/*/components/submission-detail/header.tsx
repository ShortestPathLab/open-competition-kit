import { JobStatusBadge } from "*/components/job-status-badge";
import { MePageHeader, type MeCrumb } from "*/components/me-page-header";
import { HeaderStats } from "*/components/page-header-band";
import { Stat } from "*/components/stat-strip";
import { Button } from "*/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import type {
  SubmissionDetail,
  SubmissionJob,
} from "src/lib/submission-fn";
import {
  describeJobStatus,
  formatResultValue,
  type ResultReadout,
} from "src/lib/submission-readout";
import { CopyId, ResultStat } from "./parts";

const findMeta = (readout: ResultReadout, keys: string[]) =>
  readout.meta.find((entry) => keys.includes(entry.key.toLowerCase()));

export function SubmissionHeader({
  detail,
  trail,
  jobs,
  selectedJob,
  selectedIndex,
  readout,
  onRerun,
  rerunning,
}: {
  detail: SubmissionDetail;
  trail: MeCrumb[];
  jobs: SubmissionJob[];
  selectedJob?: SubmissionJob;
  selectedIndex: number;
  readout: ResultReadout;
  onRerun: () => void;
  rerunning: boolean;
}) {
  const runtime = findMeta(readout, ["runtime", "duration", "elapsed"]);
  const warnings = findMeta(readout, ["warning", "warnings"]);

  return (
    <MePageHeader
      trail={trail}
      crumb={`Submission ${detail.number}`}
      title={
        <span className="flex flex-wrap items-center gap-3">
          {detail.trackName}
          {jobs.length > 0 ?
            <JobStatusBadge status={jobs.at(-1)?.status} />
          : null}
        </span>
      }
      description={
        <>
          <span className="block text-foreground">{detail.competitionName}</span>
          <CopyId value={detail.id} />
        </>
      }
      actions={
        <>
          {/* Running again scores the same submission, so the header carries both
              that and the way to send a different one. */}
          <Button
            variant="outline"
            size="lg"
            className="h-10 px-5"
            onClick={onRerun}
            disabled={rerunning}
          >
            {rerunning ?
              <Loader2 className="animate-spin" />
            : <RotateCcw />}
            Run again
          </Button>
          <Button
            size="lg"
            className="h-10 px-5"
            render={
              <Link
                to="/competitions/$id/submissions/new"
                params={{ id: detail.competitionId }}
                search={{ trackId: detail.trackId }}
              />
            }
          >
            <Plus />
            New submission
          </Button>
        </>
      }
      meta={
        <HeaderStats>
          <ResultStat
            job={selectedJob}
            readout={readout}
            runNumber={selectedIndex + 1}
            runCount={jobs.length}
          />
          <Stat label="Runs" value={jobs.length} />
          <Stat
            label="Last run"
            value={
              <span className="font-sans text-base">
                {describeJobStatus(jobs.at(-1)?.status).label}
              </span>
            }
          />
          {runtime ?
            <Stat
              label={runtime.label}
              value={formatResultValue(runtime.value)}
            />
          : null}
          {warnings ?
            <Stat
              label={warnings.label}
              value={formatResultValue(warnings.value)}
            />
          : null}
        </HeaderStats>
      }
    />
  );
}
