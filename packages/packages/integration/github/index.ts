import { once } from "es-toolkit";
import { Octokit } from "octokit";
import { kit, unsafe, type Package } from "sdk";
import { z } from "zod";

const MAX_SUBMISSION_ARCHIVE_BYTES = 10 * 1024 * 1024;
const GITHUB_REF_SELECT_KIND = "github:ref-select";
const GITHUB_REF_FIELD_KEY = "github:ref";

const githubOrg = once(async () => {
  return String(await unsafe(kit.secrets.global.get("GITHUB_ORG")));
});

type GithubRefOption = {
  key: string;
  label: string;
  value: string;
};

const githubRefSelection = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
});

type GithubRefSelection = z.infer<typeof githubRefSelection>;

const selectedRefValue = z.union([
  z.string(),
  z.object({
    [GITHUB_REF_FIELD_KEY]: z.string(),
  }),
]);

const selectedRefBody = z
  .union([
    z.string(),
    z.object({
      [GITHUB_REF_FIELD_KEY]: z.string(),
    }),
    z.object({
      value: selectedRefValue,
    }),
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

function participantRepositoryName(githubUsername: string) {
  return `participant-${githubUsername.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

async function listLatestRefsForUser(): Promise<GithubRefOption[]> {
  const githubUsername = String(
    await unsafe(kit.secrets.user.get("GITHUB_USERNAME")),
  );
  const owner = await githubOrg();
  const repo = participantRepositoryName(githubUsername);
  const client = await octokit();

  const { data } = await client.request("GET /repos/{owner}/{repo}/branches", {
    owner,
    repo,
    per_page: 100,
  });

  return data.map(({ name }) => ({
    key: name,
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

  return {
    owner,
    repo,
    ref: selectedRef,
  };
}

async function ensureParticipantRepository(githubUsername: string) {
  const owner = await githubOrg();
  const repo = participantRepositoryName(githubUsername);
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
    username: githubUsername,
    permission: "push",
  });

  return { owner, repo };
}

export default {
  enrolments: {
    enrol: async (args, next) => {
      const enrolmentId = await next?.(args);
      if (!enrolmentId) {
        throw new Error("GitHub integration requires an enrolment hook.");
      }

      const githubUsername = String(
        await unsafe(kit.secrets.user.get("GITHUB_USERNAME")),
      );
      await ensureParticipantRepository(githubUsername);

      return enrolmentId;
    },
  },
  form: {
    loader: async ({ def }, next) => {
      const options = await listLatestRefsForUser();
      const nextDef = {
        ...def,
        shape: def.shape.map((shapeItem) =>
          shapeItem.kind === GITHUB_REF_SELECT_KIND
            ? {
                ...shapeItem,
                kind: "select",
                options,
              }
            : shapeItem,
        ),
      };

      return (await next?.({ def: nextDef })) ?? { def: nextDef };
    },
  },
  runner: {
    run: async ({ job }, next) => {
      const jobRecord = await unsafe(kit.jobs.get(job));
      const submission = await unsafe(
        kit.submissions.get(jobRecord.submission),
      );
      const githubUsername = String(
        await unsafe(kit.secrets.user.get("GITHUB_USERNAME")),
      );
      const owner = await githubOrg();
      const repo = participantRepositoryName(githubUsername);
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

      if (archive.byteLength > MAX_SUBMISSION_ARCHIVE_BYTES) {
        throw new Error(
          `Submission archive exceeds ${MAX_SUBMISSION_ARCHIVE_BYTES} bytes.`,
        );
      }

      await unsafe(
        kit.context.set(
          jobRecord.id,
          "standard:submission/code",
          archive.toString("base64"),
        ),
      );

      return (
        (await next?.({ job })) ??
          // Shouldn't really hit this branch
          // as it means we don't have a runner lined up.
          { status: "prepared" }
      );
    },
  },
} satisfies Package;
