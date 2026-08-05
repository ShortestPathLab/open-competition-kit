import { kit, surface, surfaces, unsafe } from "@open-competition-kit/sdk";
import { GITHUB_REF_SELECT_KIND, GITHUB_WEB, REPOSITORY_CARD } from "./constants";
import {
  branchesFor,
  githubOrg,
  hasPushAccess,
  repositoryExists,
  repositoryFor,
  username,
} from "./github";
import { refOfSubmission } from "./refs";

/**
 * Whether this competitor has entered anything in this competition. The
 * repository is created on enrolment, so a link offered before then hands
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
 * Explaining branches on a track that takes a zip would be a lie, and this is the
 * same field the form loader rewrites, so the two cannot drift apart.
 */
async function usesGithubRef(track: string) {
  const form = await unsafe(kit.forms.get(track));
  return form.shape.some((field: { kind?: string }) => field.kind === GITHUB_REF_SELECT_KIND);
}

/**
 * What this integration has to say for itself.
 *
 * Enrolment creates a repository and grants push access, and without this it told
 * nobody. The pages that should mention it cannot be expected to know what a
 * repository is, so the knowledge arrives from here as content the host draws in
 * its own design.
 */
export const content = surfaces({
  [surface.std.competitionYou]: async ({ user, subject }) => {
    if (!user || !(await hasEnrolment(user, subject.competition))) return [];

    const { owner, repo, url } = await repositoryFor(user);
    // A rate limit or an outage costs the branch list, not the card. The renderer
    // says so, which beats a panel that fails to appear.
    const branches = await branchesFor(owner, repo).catch(() => []);

    return [
      {
        kind: "component",
        id: "github/repository",
        view: REPOSITORY_CARD,
        // Bare, because this region is already inside the competition rail's own
        // panel. Asking for `panel` here would draw a card inside a card.
        chrome: "bare",
        props: { owner, repo, url, branches },
        fallback: {
          title: "Your repository",
          body: `\`${owner}/${repo}\` is ready for your next push.`,
          actions: [
            {
              label: "Open on GitHub",
              href: url,
              external: true,
              icon: "github",
            },
          ],
        },
      },
    ];
  },

  [surface.std.trackDetail]: async ({ user }) => {
    if (!user) return [];
    const { owner, repo } = await repositoryFor(user);

    // Enrolment is what creates the repository, and the readiness card above this
    // already says they have not enrolled. Two ways of saying it is one too many.
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
          canPush
            ? { label: "Push access active", state: "ok" as const }
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
        actions: [{ label: "Open repository", href: url, external: true, icon: "github" }],
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
        actions: [{ label: "Open repository", href: url, external: true, icon: "github" }],
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
});
