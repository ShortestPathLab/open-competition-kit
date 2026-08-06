import {
  enrolments,
  jobs,
  JobStatus,
  submissions,
  tracks,
  unsafe,
  type Package,
} from "@open-competition-kit/sdk";

/**
 * What every competition does, and nothing that only some of them do.
 *
 * A default package, applied without appearing in anybody's `with:`, which is why
 * it declares no config at all. A field is the one thing installing another
 * package cannot take back: behaviour is overridable by position, since the last
 * entry in `with:` is outermost and an implementation that does not call `next`
 * replaces everything beneath it, but there is no way to un-declare a key. So a
 * package that arrives uninvited has no business bringing a vocabulary with it.
 *
 * That rule is what emptied this package out. The submission gates, the computed
 * leaderboard and the local machine each moved to a package of their own, and
 * what is left is a competitor joining a track and a competitor handing work in.
 * Both are the same in every competition anyone has described, and neither has a
 * setting to get wrong.
 */
export default {
  name: "@open-competition-kit/standard",
  description:
    "Enrolment and submission, as every competition does them. Installed by default and declares no configuration.",
  version: "0.0.11",
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
    /**
     * The submission, and a job to evaluate it.
     *
     * Yields to `next` first, so a competition that submits somewhere else keeps
     * its own answer. One job per submission is an assumption rather than a law,
     * and it is the one every competition here has wanted.
     */
    submit: async (args, next) => {
      const inherited = await next?.(args);
      if (inherited) return inherited;

      const submission = await unsafe(
        submissions.create({ user: args.user, body: args.body, track: args.track }),
      );
      const job = await unsafe(
        jobs.create({ submission: submission.id, status: JobStatus.pending, claimedAt: "" }),
      );

      return { submission: submission.id, jobs: [job.id] };
    },
  },
} satisfies Package;
