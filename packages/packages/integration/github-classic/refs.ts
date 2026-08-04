import { kit, unsafe } from "@open-competition-kit/sdk";
import { z } from "zod";
import { GITHUB_REF_FIELD_KEY, GITHUB_WEB } from "./constants";
import { branchesFor, repositoryFor } from "./github";

export type GithubRefOption = { id: string; label: string; value: string };

const githubRefSelection = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
});

export type GithubRefSelection = z.infer<typeof githubRefSelection>;

const selectedRefValue = z.union([
  z.string(),
  z.object({ [GITHUB_REF_FIELD_KEY]: z.string() }),
]);

/** Every shape a submission body has used to carry the chosen ref. */
const selectedRefBody = z
  .union([
    z.string(),
    z.object({ [GITHUB_REF_FIELD_KEY]: z.string() }),
    z.object({ value: selectedRefValue }),
  ])
  .transform((body) => {
    if (typeof body === "string") return body;
    if (GITHUB_REF_FIELD_KEY in body) return body[GITHUB_REF_FIELD_KEY];
    return typeof body.value === "string" ?
        body.value
      : body.value[GITHUB_REF_FIELD_KEY];
  });

export async function listLatestRefsForUser(
  user: string,
): Promise<GithubRefOption[]> {
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

export async function resolveSelectedRef(
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

/**
 * The ref a submission was taken from, or nothing when it was not taken from one.
 *
 * A submission that predates the integration, or came from a track that uploads
 * an archive, has no ref in its body. That is ordinary rather than exceptional, so
 * it reads as an absent contribution instead of a logged failure.
 */
export async function refOfSubmission(id: string) {
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
