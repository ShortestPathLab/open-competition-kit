import { Effect as E, Match as M } from "effect";
import { verdictOf } from "../gate";
import type { schemas } from "../hook/db";
import { JobStatus, staleClaims } from "../job";
import { withCollectionUtilities } from "./collection-utils";
import { createNamespacedContext } from "./context-store";
import type { Entities } from "./entities";
import { SubmissionRefusedError } from "./errors";
import type { Runtime } from "./runtime";

let warnedAboutClaims = false;

/**
 * Said once per process, because it is about the deployment rather than the job.
 *
 * Repeating it per poll would bury it in the log the operator needs to read.
 */
const warnOnceAboutClaims = () => {
  if (warnedAboutClaims) return;
  warnedAboutClaims = true;
  console.warn(
    "[jobs] The installed database package does not implement `db.claim`, so a job " +
      "is taken by reading it and then writing it. One runner service is fine: its " +
      "poll loop only runs one sweep at a time. Two will evaluate the same " +
      "submission twice. Install a database package that answers `db.claim` before " +
      "running more than one runner.",
  );
};

/** What competitors do: enrol, submit, and have their work run. */
export const createParticipation = ({ hooks, instance }: Runtime, { tracks, users }: Entities) => {
  const namespaced = createNamespacedContext(instance);

  const enrolments = {
    ...withCollectionUtilities(
      instance.enrolments,
      (enrolment) => tracks.get(enrolment.track),
      (owner: typeof schemas.user.Type | typeof schemas.track.Type) =>
        M.value(owner).pipe(
          M.tag("open-competition-kit/db/user", (user) =>
            instance.enrolments.list({ user: user.id }),
          ),
          M.tag("open-competition-kit/db/track", (track) =>
            instance.enrolments.list({ track: track.id }),
          ),
          M.exhaustive,
        ),
    ),
    isEnrolled: (user: string, track: string) =>
      E.gen(function* () {
        const trackDetails = yield* tracks.get(track);
        const es = yield* enrolments.list({
          track,
          competition: trackDetails.competition,
          user,
        });
        return !!es.length;
      }),
    enrol: (user: string, track: string) =>
      hooks.do((h) => h.enrolments.enrol({ user, track }), {
        competitions: { tracks: track },
      }),
  };

  const submissions = {
    ...withCollectionUtilities(
      instance.submissions,
      (submission) => tracks.get(submission.track),
      (track) => instance.submissions.list({ track: track.id }),
    ),
    /**
     * Ask the gate chain whether this user may submit, without submitting.
     *
     * Seeded with an empty list: core contributes no refusals of its own, so every
     * rule here comes from a package and can be read off the config that installed
     * it. The submission form asks this before rendering.
     */
    gate: (user: string, track: string) =>
      E.gen(function* () {
        const refusals = yield* hooks.do((h) => h.submissions.gate({ user, track, refusals: [] }), {
          competitions: { tracks: track },
        });
        return verdictOf(refusals ?? []);
      }),
    /**
     * What every installed gate has to say about a track, refusing or not. Seeded
     * empty for the same reason `gate` is. `user` is optional because most of the
     * answer does not depend on who is asking: a track list renders for signed-out
     * readers and still wants to say when each track closes.
     */
    status: (track: string, user?: string) =>
      E.gen(function* () {
        const reports = yield* hooks.do((h) => h.submissions.status({ track, user, reports: [] }), {
          competitions: { tracks: track },
        });
        return reports ?? [];
      }),
    submit: (user: string, body: string, track: string) =>
      E.gen(function* () {
        // The same question the form asked, asked again where it counts. A caller
        // that never rendered a form is held to the same rules.
        const verdict = yield* submissions.gate(user, track);
        if (!verdict.allowed) {
          return yield* new SubmissionRefusedError({
            track,
            refusals: verdict.refusals,
          });
        }
        return yield* hooks.do((h) => h.submissions.submit({ user, track, body }), {
          competitions: { tracks: track },
        });
      }),
  };

  const jobs = {
    ...withCollectionUtilities(
      instance.jobs,
      (job) => submissions.get(job.submission),
      (submission) => instance.jobs.list({ submission: submission.id }),
    ),
    context: namespaced("open-competition-kit/namespace/job"),
    createFromSubmission: (submission: string) =>
      E.gen(function* () {
        const created = yield* instance.jobs.create({
          submission,
          status: JobStatus.pending,
          claimedAt: "",
        });
        return { jobs: [created.id] };
      }),
    /**
     * Take a pending job, if it is still there to take.
     *
     * The answer is whether this caller may run it, and only one caller can get
     * `true` for a given job. Everything about running more than one runner
     * service rests on that, so it is worth being precise about what happens
     * when the database cannot promise it: `db.claim` returning `undefined`
     * means nothing implemented the compare-and-set, and the read-then-write
     * below is a real race, not a smaller one. It is allowed because a single
     * runner is serialised by its own poll loop and that is a supported way to
     * run this. It says so once, loudly, rather than letting an operator scale
     * to two runners on the assumption that the queue is safe.
     */
    claim: (job: string, now: string) =>
      E.gen(function* () {
        const won = yield* instance.jobs.claim(
          job,
          { status: JobStatus.pending },
          { status: JobStatus.running, claimedAt: now },
        );
        if (won !== undefined) return won;

        warnOnceAboutClaims();
        const current = yield* jobs.get(job);
        if (current.status !== JobStatus.pending) return false;
        yield* instance.jobs.update({ id: job, status: JobStatus.running, claimedAt: now });
        return true;
      }),
    /** Put a job back, so whatever went wrong can be retried rather than stranded. */
    release: (job: string, status: string) =>
      instance.jobs.update({ id: job, status, claimedAt: "" }),
    /**
     * Return jobs whose holder is never coming back.
     *
     * A process killed between claiming a job and writing its outcome leaves the
     * row saying `running` forever, and nothing else will ever look at it. The
     * guard on the conditional write is the claim stamp the sweep read, so a
     * runner that is alive and updates the stamp keeps its job.
     */
    sweepStaleClaims: (before: string) =>
      E.gen(function* () {
        const held = yield* instance.jobs.list({ status: JobStatus.running });
        const stale = staleClaims(held, before);
        const reclaimed: string[] = [];
        for (const job of stale) {
          const won = yield* instance.jobs.claim(
            job.id,
            { status: JobStatus.running, claimedAt: job.claimedAt },
            { status: JobStatus.pending, claimedAt: "" },
          );
          // `undefined` is the unsupported case again. Sweeping without a guard
          // would race the very process it is trying to clean up after, so it
          // does nothing instead and `claim` has already said why.
          if (won === true) reclaimed.push(job.id);
        }
        return reclaimed;
      }),
    run: (job: string) =>
      E.gen(function* () {
        const c = yield* jobs
          .get(job)
          .pipe(E.andThen(jobs.owner), E.andThen(submissions.owner), E.andThen(tracks.owner));
        yield* hooks.do((h) => h.runner.setup({ job }), {
          competitions: c.id,
        });
        const outcome = yield* hooks.do((h) => h.runner.run({ job }), { competitions: c.id });
        yield* hooks.do((h) => h.runner.teardown({ job }), {
          competitions: c.id,
        });
        // Handed back rather than discarded so the caller can tell "a runner
        // took this and finished" from "every runner passed on it". The second
        // one leaves the row claimed by a runner that is not going to write a
        // status, which used to mean the job sat pending and was retried at the
        // poll interval for the life of the service.
        return outcome ?? { status: JobStatus.skipped };
      }),
  };

  const context = {
    ...namespaced(),
    ...withCollectionUtilities(
      instance.context,
      (ctx) =>
        M.value(ctx).pipe(
          M.when({ namespace: "open-competition-kit/namespace/job" }, (c) => jobs.get(c.owner)),
          M.when({ namespace: "open-competition-kit/namespace/user" }, (c) => users.get(c.owner)),
          M.when({ namespace: "open-competition-kit/namespace/user/secret" }, (c) =>
            users.get(c.owner),
          ),
          M.when({ namespace: "open-competition-kit/namespace/job/output" }, (c) =>
            jobs.get(c.owner),
          ),
          M.when({ namespace: "open-competition-kit/namespace/submission" }, (c) =>
            submissions.get(c.owner),
          ),
          M.exhaustive,
        ),
      (owner: typeof schemas.user.Type | typeof schemas.job.Type) =>
        M.value(owner).pipe(
          M.tag("open-competition-kit/db/job", () =>
            instance.context.list({
              owner: owner.id,
              namespace: "open-competition-kit/namespace/job",
            }),
          ),
          M.tag("open-competition-kit/db/user", () =>
            instance.context.list({
              owner: owner.id,
              namespace: "open-competition-kit/namespace/user",
            }),
          ),
          M.exhaustive,
        ),
    ),
  };

  const outputs = namespaced("open-competition-kit/namespace/job/output");

  return { enrolments, submissions, jobs, context, outputs };
};
