/**
 * Asking every installed package what it has to say about one region.
 *
 * The one place the chain is run for content, so the ordering rules, the reader
 * it is run for, and the config node it is resolved against are decided once.
 * A page only names the region and what it is about.
 */
import { useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, { cast, hooks, unsafe, type ConfigAccessor } from "@open-competition-kit/sdk";
import {
  audienceOf,
  orderItems,
  type Subject,
  type SurfaceContext,
  type SurfaceItem,
  type SurfaceRequest,
} from "@open-competition-kit/sdk/surface";
import { isVisibleTo } from "@open-competition-kit/sdk/visibility";
import { z } from "zod";
import { adminStatus, ensureAdmin } from "./admin";
import { getAuthSession } from "./auth-server";
import { resolveId } from "./configure-user";

const subjectInput = z
  .object({
    competition: z.string().optional(),
    track: z.string().optional(),
    enrolment: z.string().optional(),
    submission: z.string().optional(),
    job: z.string().optional(),
  })
  .default({});

const surfaceInput = z.object({
  surface: z.string(),
  subject: subjectInput,
});

/**
 * A record, or nothing.
 *
 * An id that names no record is ordinary here rather than exceptional: a
 * bookmarked page, a retired track, a submission from a reset database. Throwing
 * would turn any of those into a failed request on an otherwise working page.
 */
async function lookup<T>(result: Promise<{ error: unknown; value?: T }>) {
  const resolved = await result;
  return resolved.error ? undefined : resolved.value;
}

/**
 * Fill in the ids the caller did not have to look up.
 *
 * A submission page knows a submission id and nothing else, but a contributor
 * asked about that submission usually wants the track it went to, and the
 * competition above it decides which packages are even installed. Walking up
 * here means one lookup per page instead of the same lookup in every caller.
 */
async function widen(subject: Subject): Promise<Subject> {
  const widened: Subject = { ...subject };

  if (widened.enrolment) {
    const enrolment = await lookup(sdk.enrolments.get(widened.enrolment));
    widened.track ??= enrolment?.track;
    widened.competition ??= enrolment?.competition;
  }

  if (!widened.submission && widened.job) {
    const job = await lookup(sdk.jobs.get(widened.job));
    widened.submission = job?.submission;
  }

  if (!widened.track && widened.submission) {
    const submission = await lookup(sdk.submissions.get(widened.submission));
    widened.track = submission?.track;
  }

  if (!widened.competition && widened.track) {
    const track = await lookup(sdk.tracks.get(widened.track));
    widened.competition = track?.competition;
  }

  return widened;
}

/**
 * Whether this reader is allowed to be told about this subject.
 *
 * The same rules the route guards apply, for the same reason they apply them
 * there: this is a `createServerFn`, so it is a public HTTP endpoint that anyone
 * can call with any id, whether or not a page ever renders it. Without this, a
 * guessed submission id would answer with somebody else's repository and the
 * branch they submitted from.
 *
 * An unauthorised subject reads as one with nothing to say rather than as a
 * refusal, so the endpoint cannot be used to find out which ids are real.
 */
async function mayRead(
  subject: Subject,
  user: string | undefined,
  isAdmin: boolean,
): Promise<boolean> {
  if (subject.competition) {
    const config = await unsafe(sdk.config.get());
    const competition = config.competitions.find(
      (candidate) => candidate.id === subject.competition,
    );
    if (!competition || !isVisibleTo(competition, isAdmin)) return false;
  }

  // An organiser is allowed the whole competition; everyone else is allowed
  // their own row and nothing else. A job is covered by its submission, which
  // `widen` has already resolved.
  if (isAdmin) return true;

  if (subject.submission) {
    const submission = await lookup(sdk.submissions.get(subject.submission));
    if (!submission || submission.user !== user) return false;
  }

  if (subject.enrolment) {
    const enrolment = await lookup(sdk.enrolments.get(subject.enrolment));
    if (!enrolment || enrolment.user !== user) return false;
  }

  return true;
}

/**
 * Which config node's packages get asked.
 *
 * The most specific node available, because `with:` propagates downward: a
 * track's list already contains its competition's, which already contains the
 * root's. Resolving at the track therefore includes everything the competition
 * installed, while resolving at the root would miss whatever the track added.
 */
function accessorFor(subject: Subject): ConfigAccessor {
  if (subject.track) return { competitions: { tracks: subject.track } };
  if (subject.competition) return { competitions: subject.competition };
  return true;
}

/**
 * The items, and the context they were built for.
 *
 * The context goes back to the browser because a `component` item's renderer is
 * given the same values `content` saw, and half of them were derived here: the
 * page knew a submission id, and the contributor was told the track and
 * competition above it.
 */
export type SurfaceContent = {
  context: SurfaceContext;
  items: SurfaceItem[];
};

const getSurfaceContent = createServerFn({ method: "GET" })
  .inputValidator(surfaceInput)
  .handler(async ({ data }): Promise<SurfaceContent> => {
    const audience = audienceOf(data.surface);
    // An organiser region is enforced here rather than left to the page that
    // happens to ask for one, for the same reason the subject is checked below.
    if (audience === "organiser") await ensureAdmin();

    const [session, admin] = await Promise.all([getAuthSession(), adminStatus()]);
    const user = session?.user ? resolveId(session.user) : undefined;
    const subject = await widen(data.subject);

    const context: SurfaceContext = {
      surface: data.surface,
      audience,
      user,
      subject,
    };

    if (!(await mayRead(subject, user, admin.isAdmin))) {
      return { context, items: [] };
    }

    const request: SurfaceRequest = { ...context, items: [] };

    // `noop` sits innermost and answers with nothing, which is what an empty
    // region looks like: no packages contributed, so there is no list.
    const items =
      (await unsafe(
        cast<readonly SurfaceItem[] | undefined>()(
          hooks.do((h) => h.surface.content(request), accessorFor(subject)),
        ),
      )) ?? [];

    return { context, items: [...orderItems(items)] };
  });

/**
 * One region's content for the reader looking at it.
 *
 * `sessionUserId` never reaches the server, which reads the session itself. It
 * separates one signed-in reader's cached content from the next's, so signing
 * out does not leave the previous reader's repository on screen.
 */
export function useSurface(surface: string, subject: Subject, sessionUserId?: string) {
  const getSurfaceContentFn = useServerFn(getSurfaceContent);
  return useQuery({
    queryKey: ["surface", surface, subject, sessionUserId],
    queryFn: () => getSurfaceContentFn({ data: { surface, subject } }),
    // Contributions are derived rather than stored, and some of them cost a call
    // to somebody else's API. A minute is long enough that moving between pages
    // does not re-ask, and short enough that a repository created a moment ago
    // shows up without a reload.
    staleTime: 60_000,
  });
}
