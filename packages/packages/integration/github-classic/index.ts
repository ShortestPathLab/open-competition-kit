import { assert, isNotNil, isNumber, memoize, once } from "es-toolkit";
import { Octokit } from "octokit";
import {
  kit,
  unsafe,
  users,
  type Package,
  reference,
  cast,
  secrets,
} from "@open-competition-kit/sdk";
import { z } from "zod";

/**
 * The archive now goes to the `files` backend rather than being base64'd into a
 * database row, so this cap is a sanity limit rather than a structural one — the
 * old 10MB ceiling existed because of where the bytes were being put.
 */
const DEFAULT_MAX_SUBMISSION_ARCHIVE_BYTES = 512 * 1024 * 1024;
const GITHUB_REF_SELECT_KIND = "github:ref-select";
const GITHUB_REF_FIELD_KEY = "github:ref";

const maxArchiveBytes = once(async () => {
  const config = await unsafe(kit.config.get());
  const limit = (config.largeFiles as { maxBytes?: number } | undefined)
    ?.maxBytes;
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

async function listLatestRefsForUser(user: string): Promise<GithubRefOption[]> {
  const owner = await githubOrg();
  const repo = await participantRepositoryName(user);
  const client = await octokit();

  const { data } = await client.request("GET /repos/{owner}/{repo}/branches", {
    owner,
    repo,
    per_page: 100,
  });
  console.log(data);
  return data.map(({ name }) => ({
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
