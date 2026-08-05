import { assert, isNotNil, isNumber, memoize, once } from "es-toolkit";
import { Octokit } from "octokit";
import { kit, secrets, unsafe } from "@open-competition-kit/sdk";
import { DEFAULT_MAX_SUBMISSION_ARCHIVE_BYTES, GITHUB_WEB } from "./constants";

export const octokit = once(async () => {
  return new Octokit({
    auth: await unsafe(kit.secrets.global.get("GITHUB_PAT")),
  });
});

export const githubOrg = once(async () => {
  return await unsafe(kit.secrets.global.require("GITHUB_ORG"));
});

/**
 * The archive has to fit wherever it is about to be stored, so the figure comes
 * from the storage backend rather than this package's own idea of large. Asking
 * through the kit also keeps this package out of another one's config block.
 */
export const maxArchiveBytes = once(async () => {
  const limit = await unsafe(kit.files.limit());
  return typeof limit === "number" && limit > 0 ? limit : DEFAULT_MAX_SUBMISSION_ARCHIVE_BYTES;
});

export const username = memoize(async (id: string) => {
  const a = await unsafe(secrets.user.get({ owner: id, reference: "auth/github/id" }));
  assert(isNotNil(a) && isNumber(+a), `GitHub ID is malformed: ${JSON.stringify(a)}`);
  const { data } = await (await octokit()).request("GET /user/{account_id}", { account_id: +a });
  return data.login;
});

export async function participantRepositoryName(id: string) {
  const u = await username(id);
  return `participant-${u.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

/** Where a competitor's repository lives, without asking GitHub whether it does. */
export async function repositoryFor(user: string) {
  const owner = await githubOrg();
  const repo = await participantRepositoryName(user);
  return { owner, repo, url: `${GITHUB_WEB}/${owner}/${repo}` };
}

export type Branch = { name: string; sha: string };

export async function branchesFor(owner: string, repo: string): Promise<Branch[]> {
  const client = await octokit();
  const { data } = await client.request("GET /repos/{owner}/{repo}/branches", {
    owner,
    repo,
    per_page: 100,
  });
  return data.map(({ name, commit }) => ({ name, sha: commit.sha }));
}

/** Whether the repository is there, as opposed to unreachable. */
export async function repositoryExists(owner: string, repo: string) {
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
 * here, which is what makes the distinction visible at all.
 */
export async function hasPushAccess(owner: string, repo: string, login: string) {
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

export async function ensureParticipantRepository(id: string) {
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
