/**
 * What a package wants to say inside the product.
 *
 * Import-free the way `./gate` is: core declares the shape, packages contribute
 * records, and the browser renders them, so the sentence a competitor reads is
 * the one the package wrote. Nothing in here reaches the database or the hook
 * system, which is what lets a client component import it without paying for
 * either.
 *
 * The division of labour is the point. A package knows that it created a
 * repository and where it lives; it does not know what a panel looks like, and
 * should not have to ship a stylesheet to say one sentence. So contributions are
 * serialisable data by default, drawn by the host in the host's own design, and
 * a bundled component is the escape hatch rather than the mechanism.
 */
import type { Source } from "./hook/component";
import type { SerialisableObject } from "./serialisable";

export const stem = "open-competition-kit/surface" as const;

/**
 * A region of the product a package can contribute to.
 *
 * Namespaced under the stem for the same reason `reference.output` is: two
 * packages that both pick the bare word `overview` would be fighting over one
 * region with nothing to tell them apart, and a slot pointed at the other
 * spelling renders empty with no error to explain it.
 */
export const region = <T extends string>(name: T) => `${stem}/${name}` as const;

/**
 * The regions the shipped UI asks about.
 *
 * A region only exists once something renders it. Adding an id here without
 * putting a slot in the host would advertise a place to write that nobody ever
 * reads.
 */
export const std = {
  /** The reader's own row in the competition rail, beside their submission count. */
  competitionYou: region("competition/you"),
  /** Under the competition's overview prose, for setup a competitor needs once. */
  competitionOverview: region("competition/overview"),
  /** A single track's page, under its readiness card. */
  trackDetail: region("track/detail"),
  /** Straight after enrolling, where what just happened is still news. */
  enrolmentDone: region("enrolment/done"),
  /** Beside the submission form, for how to prepare one. */
  submissionNew: region("submission/new"),
  /** A submission's detail page, for where its contents came from. */
  submissionDetail: region("submission/detail"),
  /** One evaluation run, for logs and artefacts that live elsewhere. */
  jobDetail: region("job/detail"),
  /** The reader's own overview, across every competition they have entered. */
  meOverview: region("me/overview"),
  /** The organiser dashboard. Only an organiser is served this one. */
  dashboardOverview: region("dashboard/overview"),
} as const;

/**
 * What each region is about.
 *
 * The ids a contributor gets typed help for. `surface` on the wire stays a
 * plain string, so a package can target a region a newer host added without
 * waiting for a core release, in the same way `Refusal.gate` is documented as
 * stable without being enumerated.
 */
type Subjects = {
  "competition/you": { competition: string };
  "competition/overview": { competition: string };
  "track/detail": { competition: string; track: string };
  "enrolment/done": { competition: string; track: string; enrolment: string };
  "submission/new": { competition: string; track: string };
  "submission/detail": { submission: string };
  "job/detail": { job: string };
  "me/overview": {};
  "dashboard/overview": { competition: string };
};

export type Surfaces = {
  [K in keyof Subjects as `${typeof stem}/${K}`]: Subjects[K];
};

export type SurfaceId = keyof Surfaces;

/**
 * What the region is about, as ids.
 *
 * Every field is optional because the same type describes every region, and the
 * host fills in what it can derive: a submission implies its track, and a track
 * implies its competition, so a contributor asked about a submission still knows
 * which competition it belongs to.
 */
export type Subject = {
  competition?: string;
  track?: string;
  enrolment?: string;
  submission?: string;
  job?: string;
};

export type Audience = "participant" | "organiser";

/**
 * Regions only an organiser may read.
 *
 * Enforced by the host before the chain runs. A server function is a public
 * endpoint whether or not a route renders it, so a region that carries
 * organiser-only content has to be listed here rather than trusted to stay
 * behind an organiser-only page.
 */
export const organiserOnly: readonly string[] = [std.dashboardOverview];

export const audienceOf = (surface: string): Audience =>
  organiserOnly.includes(surface) ? "organiser" : "participant";

export type SurfaceAction = {
  label: string;
  href: string;
  /** Leaves the app, so the host marks it and does not route it internally. */
  external?: boolean;
  style?: "primary" | "secondary" | "link";
  /**
   * One of the host's known icon names, e.g. `github` or `external`. An
   * unrecognised name draws nothing rather than a placeholder, so a package can
   * name an icon a newer host has without breaking an older one.
   */
  icon?: string;
};

type Base = {
  /**
   * Stable and namespaced by the contributing package, e.g. `github/repository`.
   *
   * Serves as the render key, decides which of two identical contributions
   * survives, and is what an organiser would name to suppress one. A generated
   * id would break all three the moment the page reloaded.
   */
  id: string;
  /**
   * Sort order, ascending, default 0. Ties keep chain order, which runs from the
   * last package listed in `with:` to the first.
   */
  weight?: number;
};

export type SurfaceNote = Base & {
  kind: "note";
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  /** Markdown, rendered the way a track's rules are. */
  body?: string;
  actions?: SurfaceAction[];
};

export type SurfaceItem =
  | SurfaceNote
  | (Base & { kind: "action" } & SurfaceAction)
  | (Base & {
      kind: "fact";
      label: string;
      value: string;
      href?: string;
      external?: boolean;
    })
  | (Base & {
      kind: "code";
      title?: string;
      /** For the label only. The host does not highlight. */
      language?: string;
      body: string;
    })
  | (Base & {
      kind: "checklist";
      title?: string;
      steps: readonly {
        label: string;
        state: "ok" | "pending" | "blocked";
        detail?: string;
        action?: SurfaceAction;
      }[];
    })
  | (Base & {
      kind: "component";
      /**
       * Which registered renderer draws this, resolved through `surface.view`.
       * Often the same string as `id`, though two items may share a renderer and
       * differ only in `props`.
       */
      view: string;
      props?: SerialisableObject;
      /**
       * Host chrome around it. `panel` puts it in the app's panel under `title`,
       * so a package that only wants the inside of a card does not redraw one.
       */
      chrome?: "panel" | "bare";
      title?: string;
      /**
       * Drawn instead when the bundle fails or no package owns the view.
       *
       * Worth writing. A component crosses a build step and a shadow boundary,
       * either of which can fail on a machine you do not own, and the failure
       * lands in the middle of somebody's competition page.
       */
      fallback?: Omit<SurfaceNote, "kind" | "id" | "weight">;
    });

/**
 * The payload threaded through the content chain.
 *
 * `items` carries what the packages further out have already contributed. Every
 * implementation appends its own and passes the combined list inward, the same
 * way `form.loader` threads its `def` and the gate chain threads its refusals.
 */
export type SurfaceRequest = {
  surface: string;
  audience: Audience;
  /** Absent when nobody is signed in, which most regions still render for. */
  user?: string;
  subject: Subject;
  items: readonly SurfaceItem[];
};

/** Everything a view is told about why it is on screen. */
export type SurfaceContext = Omit<SurfaceRequest, "items">;

export type SurfaceViewProps<
  TProps extends SerialisableObject = SerialisableObject,
> = {
  /** Whatever the contributing package put on the item. */
  props: TProps;
  /** The same values `content` was given, minus the chain's accumulator. */
  context: SurfaceContext;
};

export type SurfaceContentHook = (
  request: SurfaceRequest,
  next?: (request: SurfaceRequest) => Promise<readonly SurfaceItem[]>,
) => Promise<readonly SurfaceItem[]>;

export type SurfaceViewHook = (
  request: { view: string },
  next?: (
    request: { view: string },
  ) => Promise<Source<SurfaceViewProps> | undefined>,
) => Promise<Source<SurfaceViewProps> | undefined>;

/**
 * The order and identity rules, kept next to the types so every caller applies
 * the same ones.
 *
 * First contribution of an id wins, which is the outermost package: the one
 * listed last in `with:`, and so the one closest to the organiser's own
 * configuration. Sorting is by weight and then by arrival, so a package that
 * states no weight lands where the chain put it instead of somewhere arbitrary.
 */
export const orderItems = (
  items: readonly SurfaceItem[],
): readonly SurfaceItem[] => {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return unique
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (a.item.weight ?? 0) - (b.item.weight ?? 0) || a.index - b.index,
    )
    .map((entry) => entry.item);
};
