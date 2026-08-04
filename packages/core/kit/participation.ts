import { Effect as E, Match as M } from "effect";
import { verdictOf } from "../gate";
import type { schemas } from "../hook/db";
import { withCollectionUtilities } from "./collection-utils";
import { createNamespacedContext } from "./context-store";
import type { Entities } from "./entities";
import { SubmissionRefusedError } from "./errors";
import type { Runtime } from "./runtime";

/** What competitors do: enrol, submit, and have their work run. */
export const createParticipation = (
  { hooks, instance }: Runtime,
  { tracks, users }: Entities,
) => {
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
        const refusals = yield* hooks.do(
          (h) => h.submissions.gate({ user, track, refusals: [] }),
          { competitions: { tracks: track } },
        );
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
        const reports = yield* hooks.do(
          (h) => h.submissions.status({ track, user, reports: [] }),
          { competitions: { tracks: track } },
        );
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
        return yield* hooks.do(
          (h) => h.submissions.submit({ user, track, body }),
          { competitions: { tracks: track } },
        );
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
          status: "pending",
        });
        return { jobs: [created.id] };
      }),
    run: (job: string) =>
      E.gen(function* () {
        const c = yield* jobs
          .get(job)
          .pipe(
            E.andThen(jobs.owner),
            E.andThen(submissions.owner),
            E.andThen(tracks.owner),
          );
        yield* hooks.do((h) => h.runner.setup({ job }), {
          competitions: c.id,
        });
        yield* hooks.do((h) => h.runner.run({ job }), { competitions: c.id });
        yield* hooks.do((h) => h.runner.teardown({ job }), {
          competitions: c.id,
        });
      }),
  };

  const context = {
    ...namespaced(),
    ...withCollectionUtilities(
      instance.context,
      (ctx) =>
        M.value(ctx).pipe(
          M.when({ namespace: "open-competition-kit/namespace/job" }, (c) =>
            jobs.get(c.owner),
          ),
          M.when({ namespace: "open-competition-kit/namespace/user" }, (c) =>
            users.get(c.owner),
          ),
          M.when(
            { namespace: "open-competition-kit/namespace/user/secret" },
            (c) => users.get(c.owner),
          ),
          M.when(
            { namespace: "open-competition-kit/namespace/job/output" },
            (c) => jobs.get(c.owner),
          ),
          M.when(
            { namespace: "open-competition-kit/namespace/submission" },
            (c) => submissions.get(c.owner),
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
