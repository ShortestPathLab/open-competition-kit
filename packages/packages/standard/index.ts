import sdk, {
  enrolments,
  jobs,
  outputs,
  reference,
  source,
  submissions,
  tracks,
  unsafe,
  type Package,
} from "@open-competition-kit/sdk";
import Zip from "jszip";
import { config, runnerBody } from "./config";
import { standardRefusals, standardReports } from "./gates";
import { load as loadLeaderboard } from "./leaderboard";
import { local, type Run } from "./machine";

export default {
  name: "@open-competition-kit/standard",
  description:
    "Implements the standard enrolment, submission, job creation, and runner workflow for Open Competition Kit.",
  version: "0.0.6",
  config,
  enrolments: {
    enrol: async (args, next) => {
      await next?.(args);
      const track = await unsafe(tracks.get(args.track));
      const payload = { ...args, competition: track.competition };
      const existing = await unsafe(enrolments.list(payload));
      return (existing[0] ?? (await unsafe(enrolments.create(payload)))).id;
    },
  },
  /**
   * Somewhere to run a command, for a deployment that has not said where.
   *
   * Last in the chain rather than first: anything installed after this one is a
   * machine the organiser chose, and `next` is how it keeps it. The check is
   * `inherited` rather than the usual position argument because `noop` answers
   * with nothing, so a chain that reaches the bottom lands here whichever order
   * the two were listed in.
   *
   * Being the fallback is the whole point. A competition can be written, run and
   * scored before anybody decides how it will be deployed, and the decision that
   * is deferred is the one about containers rather than the one about what a
   * good evaluation is.
   */
  machine: {
    build: async (recipe, next) =>
      (await next?.(recipe)) ?? (await local.build()),
    run: async (request: Run, next) =>
      (await next?.(request)) ?? (await local.run(request)),
  },
  leaderboard: {
    loader: async ({ def, competition }, next) => {
      const inherited = await next?.({ def, competition });
      if (inherited) return inherited;

      return { def: { ...def, items: await loadLeaderboard(def, competition) } };
    },
  },
  submissions: {
    /**
     * The three rules an organiser configures on a track: its open and close
     * times, a total attempt ceiling, and a rolling rate limit.
     *
     * Additive, like every gate. Ours are appended to whatever the packages
     * further out decided and the combined list is passed inward, so installing
     * a gate of your own never displaces these.
     */
    gate: async ({ user, track, refusals }, next) => {
      const all = [
        ...refusals,
        ...(await standardRefusals(user, track, Date.now())),
      ];
      return (await next?.({ user, track, refusals: all })) ?? all;
    },
    /**
     * The same three rules as `gate`, reported rather than enforced.
     *
     * Additive in the same way, so a package that adds a gate of its own adds a
     * report beside these instead of replacing them.
     */
    status: async ({ track, user, reports }, next) => {
      const all = [
        ...reports,
        ...(await standardReports(track, user, Date.now())),
      ];
      return (await next?.({ track, user, reports: all })) ?? all;
    },
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
      // Finding the archive, and coping with the two ways an integration may
      // have handed it over, is the same problem for every runner. It lives in
      // the SDK so that a runner written outside this repository gets the
      // `FileRef` path and the legacy fallback without knowing either exists.
      const archive = await source.archive(job);

      const trackRecord = await unsafe(tracks.get(submission.track));
      const competition = await unsafe(
        sdk.competitions.get(trackRecord.competition),
      );
      const track = competition.tracks.find(
        (candidate) => candidate.id === trackRecord.id,
      );

      if (!track) {
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
        // Core no longer types `runner`, since what a runner is configured with
        // is whatever runner package is installed. Ours takes a `body:`, so ours
        // is what reads it back out.
        const { body } = runnerBody.parse(competition.runner);
        // Evaluating the configured body is what this runner is for: the
        // competition author supplies the script and we run it. Not user input
        // from a submission.
        // oxlint-disable-next-line no-eval
        const result = eval(body ?? "");
        const unzipped = await Zip.loadAsync(archive, {
          base64: typeof archive === "string",
        });
        const output = Object.entries(unzipped.files).map(
          ([k, v]) =>
            `${v.dir ? `[directory]` : `[file]`} ${k} ${v.date.toISOString()}`,
        );
        await unsafe(
          outputs.set({
            owner: jobRecord.id,
            reference: reference.output("contents"),
            value: output.join("\n"),
          }),
        );
        await unsafe(
          outputs.set({
            owner: jobRecord.id,
            reference: reference.std.output,
            value: JSON.stringify(result ?? null),
          }),
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
