/**
 * Contributing content to the product, on its own path.
 *
 * Same reason as `./gate` and `./window`: the root `index.ts` drags the whole
 * kit in, and a component that only renders a note should not pay for the
 * database and the hook system to do it. Nothing here imports either, so this
 * module is safe on both sides of the boundary.
 */
import type { Source } from "@open-competition-kit/core/hook/component";
import type {
  Subject,
  SurfaceContentHook,
  SurfaceId,
  SurfaceItem,
  SurfaceRequest,
  Surfaces,
  SurfaceViewHook,
  SurfaceViewProps,
} from "@open-competition-kit/core/surface";

export * from "@open-competition-kit/core/surface";

/**
 * The same module under a name, so a call site can say
 * `surface.std.competitionYou` and read as what it is. `std` on its own tells a
 * reader nothing about which standard.
 */
export * as surface from "@open-competition-kit/core/surface";

/**
 * The request as one region sees it, with the ids that region always carries
 * proved rather than optional.
 *
 * A contributor to `enrolment/done` is always told which enrolment, so it should
 * not have to check. A contributor to a region this build of core has never
 * heard of gets the loose subject, which is the honest answer for one.
 */
export type SurfaceRequestFor<K extends string> = Omit<SurfaceRequest, "surface" | "subject"> & {
  surface: K;
  subject: K extends SurfaceId ? Surfaces[K] & Subject : Subject;
};

export type SurfaceContributor<K extends string = string> = (
  request: SurfaceRequestFor<K>,
) => Promise<readonly SurfaceItem[]> | readonly SurfaceItem[];

export type SurfaceContributors = {
  [K in SurfaceId]?: SurfaceContributor<K>;
} & {
  /**
   * A region core does not know about yet, kept loose on purpose so a package
   * can target a newer host without waiting for a release.
   */
  [surface: string]:
    | ((request: any) => Promise<readonly SurfaceItem[]> | readonly SurfaceItem[])
    | undefined;
};

/**
 * Turn a map of regions into the chained `surface.content` hook.
 *
 * The threading is the whole reason this exists. Every implementation has to
 * append to `request.items` and pass the combined list inward, and the `?? items`
 * tail is what terminates the chain once it reaches `noop`. Written by hand once
 * per package, that is a trap; written here, it is written once.
 *
 * A contributor that throws loses its own contribution and nothing else. Unlike
 * a gate, which fails closed because the alternative lets a submission through,
 * a note that cannot be built is only a note: taking the panel down with it
 * would turn a broken integration into a broken competition page.
 */
export function surfaces(map: SurfaceContributors): SurfaceContentHook {
  return async (request, next) => {
    const contributor = map[request.surface];
    const mine = contributor
      ? await Promise.resolve(contributor(request)).catch((error) => {
          console.error(`[surface] contributor for ${request.surface} failed`, error);
          return [] as readonly SurfaceItem[];
        })
      : [];

    const items = [...request.items, ...mine];
    return (await next?.({ ...request, items })) ?? items;
  };
}

export type SurfaceViews = Record<string, () => Promise<Source<SurfaceViewProps<any>>>>;

/**
 * Turn a map of view ids into the chained `surface.view` hook.
 *
 * Mine first, then inward, which is the opposite of the `inherited ?? mine`
 * convention the action hooks use. The lookup here is exact: if the requested id
 * is in the map it is ours, and there is nothing for a package underneath to
 * have a better answer about.
 *
 * Pair each entry with `lazyComponent`, so a view is bundled once per process
 * and only if something actually asks for it.
 */
export function views(map: SurfaceViews): SurfaceViewHook {
  return async ({ view }, next) => {
    const mine = await map[view]?.();
    return mine ?? (await next?.({ view }));
  };
}
