import { assert, isNotNil, isNumber, memoize, once } from "es-toolkit";
import { Octokit } from "octokit";
import {
  kit,
  lazyComponent,
  surface,
  surfaces,
  unsafe,
  users,
  views,
  type Package,
  reference,
  cast,
  secrets,
} from "@open-competition-kit/sdk";
import { z } from "zod";
import repositoryCard from "./repository-card";

/**
 * The archive now goes to the `files` backend rather than being base64'd into a
 * database row, so this cap is a sanity limit rather than a structural one — the
 * old 10MB ceiling existed because of where the bytes were being put.
 */
const DEFAULT_MAX_SUBMISSION_ARCHIVE_BYTES = 512 * 1024 * 1024;
const GITHUB_REF_SELECT_KIND = "github:ref-select";
const GITHUB_REF_FIELD_KEY = "github:ref";
const GITHUB_WEB = "https://github.com";
/** The renderer registered under `surface.view`, and the item that asks for it. */
const REPOSITORY_CARD = "github/repository-card";

/**
 * The archive has to fit wherever it is about to be stored, so the figure comes
 * from the storage backend rather than from this package's own idea of large.
 * Asking through the kit is also what keeps this package out of another one's
 * config block, which it has no way to keep up with.
 */
const maxArchiveBytes = once(async () => {
  const limit = await unsafe(kit.files.limit());
  return typeof limit === "number" && limit > 0 ?
      limit
    : DEFAULT_MAX_SUBMISSION_ARCHIVE_BYTES;
});

const githubOrg = once(async () => {
  return await unsafe(kit.secrets.global.require("GITHUB_ORG"));
});

type GithubRefOption = { id: string; label: string; value: string };

const githubRefSelection = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
});

type GithubRefSelection = z.infer<typeof githubRefSelection>;

const selectedRefValue = z.union([
  z.string(),
  z.object({ [GITHUB_REF_FIELD_KEY]: z.string() }),
]);

const selectedRefBody = z
  .union([
    z.string(),
    z.object({ [GITHUB_REF_FIELD_KEY]: z.string() }),
    z.object({ value: selectedRefValue }),
  ])
  .transform((body) => {
    if (typeof body === "string") return body;
    if (GITHUB_REF_FIELD_KEY in body) return body[GITHUB_REF_FIELD_KEY];
    return typeof body.value === "string"
      ? body.value
      : body.value[GITHUB_REF_FIELD_KEY];
  });

const octokit = once(async () => {
  return new Octokit({
    auth: await unsafe(kit.secrets.global.get("GITHUB_PAT")),
  });
});

async function participantRepositoryName(id: string) {
  const u = await username(id);
  return `participant-${u.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

const username = memoize(async (id: string) => {
  const a = await unsafe(
    secrets.user.get({ owner: id, reference: "auth/github/id" }),
  );
  assert(
    isNotNil(a) && isNumber(+a),
    `GitHub ID is malformed: ${JSON.stringify(a)}`,
  );
  const { data } = await (
    await octokit()
  ).request("GET /user/{account_id}", { account_id: +a });
  return data.login;
});

type Branch = { name: string; sha: string };

async function branchesFor(owner: string, repo: string): Promise<Branch[]> {
  const client = await octokit();
  const { data } = await client.request("GET /repos/{owner}/{repo}/branches", {
    owner,
    repo,
    per_page: 100,
  });
  return data.map(({ name, commit }) => ({ name, sha: commit.sha }));
}

/** Where a competitor's repository lives, without asking GitHub whether it does. */
async function repositoryFor(user: string) {
  const owner = await githubOrg();
  const repo = await participantRepositoryName(user);
  return { owner, repo, url: `${GITHUB_WEB}/${owner}/${repo}` };
}

async function listLatestRefsForUser(user: string): Promise<GithubRefOption[]> {
  const { owner, repo } = await repositoryFor(user);
  const branches = await branchesFor(owner, repo);

  return branches.map(({ name }) => ({
    id: name,
    label: name,
    value: JSON.stringify({
      owner,
      repo,
      ref: name,
    } satisfies GithubRefSelection),
  }));
}

function readSelectedRef(body: string): string {
  const selectedRef = selectedRefBody.safeParse(JSON.parse(body));
  if (selectedRef.success) return selectedRef.data;

  throw new Error("GitHub submission is missing a selected ref.");
}

async function resolveSelectedRef(
  body: string,
  owner: string,
  repo: string,
): Promise<GithubRefSelection> {
  const selectedRef = readSelectedRef(body);

  try {
    const parsed = githubRefSelection.safeParse(JSON.parse(selectedRef));
    if (parsed.success) return parsed.data;
  } catch {}

  return { owner, repo, ref: selectedRef };
}

/** Whether the repository is there, as opposed to unreachable. */
async function repositoryExists(owner: string, repo: string) {
  const client = await octokit();
  try {
    await client.request("GET /repos/{owner}/{repo}", { owner, repo });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return false;
    throw error;
  }
}

/**
 * Whether the competitor can actually push yet.
 *
 * Enrolment adds them as a collaborator, which GitHub turns into an invitation
 * they have to accept. Until they do, the repository exists, the form lists no
 * branches, and nothing anywhere explains why. A pending invitation reads as 404
 * on this endpoint, which is what makes the distinction visible at all.
 */
async function hasPushAccess(owner: string, repo: string, login: string) {
  const client = await octokit();
  try {
    await client.request("GET /repos/{owner}/{repo}/collaborators/{username}", {
      owner,
      repo,
      username: login,
    });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return false;
    throw error;
  }
}

/**
 * Whether this competitor has entered anything in this competition.
 *
 * The repository is created on enrolment, so a link offered before then hands
 * somebody a 404 with our name on it.
 */
async function hasEnrolment(user: string, competition: string) {
  const rows = await unsafe(kit.enrolments.list({ user, competition }));
  return rows.length > 0;
}

/**
 * Whether a track's form asks for a ref at all.
 *
 * One competition can mix tracks: an uploaded archive here, a branch there.
 * Explaining branches on a track that takes a zip would be a lie, and this is
 * the same field the form loader rewrites, so the two cannot drift apart.
 */
async function usesGithubRef(track: string) {
  const form = await unsafe(kit.forms.get(track));
  return form.shape.some(
    (field: { kind?: string }) => field.kind === GITHUB_REF_SELECT_KIND,
  );
}

/**
 * The ref a submission was taken from, or nothing when it was not taken from
 * one.
 *
 * A submission that predates the integration, or came from a track that uploads
 * an archive, has no ref in its body. That is ordinary rather than exceptional,
 * so it reads as an absent contribution instead of a logged failure.
 */
async function refOfSubmission(id: string) {
  const submission = await unsafe(kit.submissions.get(id));
  const { owner, repo } = await repositoryFor(submission.user);
  const selected = await resolveSelectedRef(submission.body, owner, repo).catch(
    () => undefined,
  );
  if (!selected) return undefined;

  return {
    ...selected,
    url: `${GITHUB_WEB}/${selected.owner}/${selected.repo}/tree/${selected.ref}`,
  };
}

async function ensureParticipantRepository(id: string) {
  const u = await username(id);
  const owner = await githubOrg();
  const repo = await participantRepositoryName(id);
  const client = await octokit();

  try {
    await client.request("GET /repos/{owner}/{repo}", { owner, repo });
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;

    await client.request("POST /orgs/{org}/repos", {
      org: owner,
      name: repo,
      private: true,
      auto_init: true,
    });
  }

  await client.request("PUT /repos/{owner}/{repo}/collaborators/{username}", {
    owner,
    repo,
    username: u,
    permission: "push",
  });

  return { owner, repo };
}

export default {
  name: "@open-competition-kit/integration-github-classic",
  description:
    "Integrates Open Competition Kit with GitHub repositories for enrolment, branch selection, and source archive preparation.",
  version: "0.0.6",
  enrolments: {
    enrol: async (args, next) => {
      const enrolmentId = await next?.(args);
      if (!enrolmentId) {
        throw new Error("GitHub integration requires an enrolment hook.");
      }

      await ensureParticipantRepository(args.user);

      return enrolmentId;
    },
  },
  /**
   * What this integration has to say for itself.
   *
   * Everything below was invisible before: enrolment created a repository, gave
   * the competitor push access, and told nobody. The pages that should have
   * mentioned it cannot be expected to know what a repository is, so the
   * knowledge arrives from here as content the host draws in its own design.
   */
  surface: {
    content: surfaces({
      [surface.std.competitionYou]: async ({ user, subject }) => {
        if (!user || !(await hasEnrolment(user, subject.competition))) return [];

        const { owner, repo, url } = await repositoryFor(user);
        // A rate limit or an outage costs the branch list, not the card. The
        // renderer says so, which beats a panel that fails to appear.
        const branches = await branchesFor(owner, repo).catch(() => []);

        return [
          {
            kind: "component",
            id: "github/repository",
            view: REPOSITORY_CARD,
            // Bare, because this region is already inside the competition rail's
            // own panel. Asking for `panel` here would draw a card inside a card.
            chrome: "bare",
            props: { owner, repo, url, branches },
            fallback: {
              title: "Your repository",
              body: `\`${owner}/${repo}\` is ready for your next push.`,
              actions: [
                { label: "Open on GitHub", href: url, external: true, icon: "github" },
              ],
            },
          },
        ];
      },

      [surface.std.trackDetail]: async ({ user }) => {
        if (!user) return [];
        const { owner, repo } = await repositoryFor(user);

        // Enrolment is what creates the repository, and the readiness card above
        // this already says they have not enrolled. Two ways of saying it would
        // be one too many.
        if (!(await repositoryExists(owner, repo))) return [];

        const canPush = await hasPushAccess(owner, repo, await username(user));

        return [
          {
            kind: "checklist",
            id: "github/readiness",
            title: "GitHub readiness",
            steps: [
              {
                label: "Submission repository created",
                state: "ok",
                detail: `${owner}/${repo}`,
              },
              canPush ?
                { label: "Push access active", state: "ok" as const }
              : {
                  label: "Push access pending",
                  state: "pending" as const,
                  detail:
                    "GitHub emailed you an invitation to this repository. " +
                    "Until you accept it you cannot push, and the submission " +
                    "form will list no branches.",
                  action: {
                    label: "Accept the invitation",
                    href: `${GITHUB_WEB}/${owner}/${repo}/invitations`,
                    external: true,
                    icon: "github",
                  },
                },
            ],
          },
        ];
      },

      [surface.std.enrolmentDone]: async ({ user }) => {
        if (!user) return [];
        const { owner, repo, url } = await repositoryFor(user);

        return [
          {
            kind: "note",
            id: "github/repository-ready",
            tone: "success",
            title: "We have set up your submission repository",
            body:
              `You have push access to \`${owner}/${repo}\`. Commit your work ` +
              `to a branch, then choose that branch when you submit.`,
            actions: [
              { label: "Open repository", href: url, external: true, icon: "github" },
            ],
          },
          {
            kind: "code",
            id: "github/clone",
            weight: 1,
            title: "Start from a clone",
            language: "bash",
            body: `git clone git@github.com:${owner}/${repo}.git`,
          },
        ];
      },

      [surface.std.submissionNew]: async ({ user, subject }) => {
        if (!user || !(await usesGithubRef(subject.track))) return [];
        const { owner, repo, url } = await repositoryFor(user);

        return [
          {
            kind: "note",
            id: "github/how-to-submit",
            tone: "info",
            title: "Submitting from GitHub",
            body:
              `This track takes a branch of \`${owner}/${repo}\`. Push your work ` +
              `first: the form lists the branches that exist when it loads, and ` +
              `the runner takes an archive of whichever one you pick.`,
            actions: [
              { label: "Open repository", href: url, external: true, icon: "github" },
            ],
          },
        ];
      },

      [surface.std.submissionDetail]: async ({ subject }) => {
        const ref = await refOfSubmission(subject.submission);
        if (!ref) return [];

        return [
          {
            kind: "fact",
            id: "github/ref",
            label: "Source",
            value: `${ref.repo} @ ${ref.ref}`,
            href: ref.url,
            external: true,
          },
        ];
      },

      [surface.std.dashboardOverview]: async () => {
        const owner = await githubOrg();

        return [
          {
            kind: "fact",
            id: "github/organisation",
            label: "GitHub organisation",
            value: owner,
            href: `${GITHUB_WEB}/${owner}`,
            external: true,
          },
        ];
      },
    }),

    view: views({ [REPOSITORY_CARD]: lazyComponent(repositoryCard) }),
  },
  form: {
    loader: async ({ def, user }, next) => {
      const options = await listLatestRefsForUser(user).catch((c) => {
        console.error(c);
        return [];
      });
      const nextDef = {
        ...def,
        shape: def.shape.map((shapeItem) =>
          shapeItem.kind === GITHUB_REF_SELECT_KIND
            ? { ...shapeItem, kind: "select", options }
            : shapeItem,
        ),
      };

      return (await next?.({ def: nextDef, user })) ?? { def: nextDef, user };
    },
  },
  runner: {
    setup: async ({ job }, next) => {
      const jobRecord = await unsafe(kit.jobs.get(job));
      const submission = await unsafe(
        kit.submissions.get(jobRecord.submission),
      );
      const owner = await githubOrg();
      const repo = await participantRepositoryName(submission.user);
      const selectedRef = await resolveSelectedRef(
        submission.body,
        owner,
        repo,
      );
      const client = await octokit();
      const { data } = await client.request(
        "GET /repos/{owner}/{repo}/zipball/{ref}",
        selectedRef,
      );
      const archive = Buffer.from(data as ArrayBuffer);
      const limit = await maxArchiveBytes();

      if (archive.byteLength > limit) {
        throw new Error(`Submission archive exceeds ${limit} bytes.`);
      }

      // The archive goes to the large-file backend, and the job carries only a
      // reference to it. It used to be base64'd straight into a database row,
      // which inflated it by a third, could not be streamed, and put every
      // submission in every backup forever.
      const ref = await unsafe(
        kit.files.write({
          owner: jobRecord.id,
          namespace: "open-competition-kit/namespace/job",
          body: archive,
          name: `${repo}-${selectedRef.ref}.zip`,
          contentType: "application/zip",
        }),
      );

      await unsafe(
        kit.jobs.context.set({
          owner: jobRecord.id,
          reference: reference.std.submissionSource,
          value: ref,
        }),
      );

      return (
        (await next?.({ job })) ??
          // Shouldn't really hit this branch
          // as it means we don't have a runner lined up.
          { status: "prepared" }
      );
    },

    /**
     * The archive is per-job scratch: once the job is done, nothing needs it, and
     * leaving it behind means every re-run of every submission accumulates in the
     * bucket forever.
     */
    teardown: async ({ job }, next) => {
      await unsafe(kit.files.purge(job)).catch((e) =>
        console.error(`[github-classic] Could not purge files for job ${job}`, e),
      );
      return (await next?.({ job })) ?? { status: "done" };
    },
  },
} satisfies Package;
