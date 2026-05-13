import sdk, {
  cast,
  enrolments,
  jobs,
  outputs,
  reference,
  submissions,
  tracks,
  unsafe,
  type Package,
} from "sdk";

async function resolveSource(job: string) {
  const codeZipB64 = await cast<string>()(
    jobs.context.require({
      owner: job,
      reference: reference.std.submissionSourceCodeZipB64,
    }),
  );
  if (!codeZipB64.error) return codeZipB64.value;
  throw new Error(
    `Could not resolve source code for job. This package looks for sources from contexts with the following references: ${[
      reference.std.submissionSourceCodeZipB64,
    ].join(", ")}`,
  );
}

export default {
  enrolments: {
    enrol: async (args, next) => {
      await next?.(args);
      const track = await unsafe(tracks.get(args.track));
      const payload = { ...args, competition: track.competition };
      const existing = await unsafe(enrolments.list(payload));
      return (existing[0] ?? (await unsafe(enrolments.create(payload)))).id;
    },
  },
  submissions: {
    submit: async (args, next) => {
      const inherited = await next?.(args);
      if (inherited) return inherited;

      const submission = await unsafe(
        submissions.create({
          user: args.user,
          body: args.body,
          track: args.track,
        }),
      );
      const job = await unsafe(
        jobs.create({ submission: submission.id, status: "pending" }),
      );

      return { submission: submission.id, jobs: [job.id] };
    },
  },
  runner: {
    run: async ({ job }, next) => {
      const inherited = await next?.({ job });
      if (inherited) return inherited;

      const jobRecord = await unsafe(jobs.get(job));
      const submission = await unsafe(submissions.get(jobRecord.submission));
      const source = await resolveSource(job);
      const trackRecord = await unsafe(tracks.get(submission.track));
      const competitionConfig = await unsafe(
        sdk.competitions.config.get(trackRecord.competition),
      );
      const track = competitionConfig?.tracks.find(
        (candidate) => candidate.id === trackRecord.id,
      );

      if (!competitionConfig || !track) {
        throw new Error(
          `Runner configuration not found for track ${trackRecord.id}`,
        );
      }

      await unsafe(
        jobs.update({
          id: jobRecord.id,
          submission: jobRecord.submission,
          status: "running",
        }),
      );

      try {
        const competition = competitionConfig;
        const result = eval(competition.runner.body ?? "");
        await unsafe(
          outputs.set(jobRecord.id, "default", JSON.stringify(result ?? null)),
        );
        await unsafe(
          jobs.update({
            id: jobRecord.id,
            submission: jobRecord.submission,
            status: "completed",
          }),
        );
        return { status: "completed" };
      } catch (error) {
        await unsafe(
          jobs.update({
            id: jobRecord.id,
            submission: jobRecord.submission,
            status: "failed",
          }),
        );
        throw error;
      }
    },
  },
} satisfies Package;
