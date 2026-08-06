/**
 * IntelliSense-only description of the Open Competition Kit service object.
 *
 * Signatures are deliberately `unknown`; the SDK overlays the real
 * Effect-to-Promise mapping at runtime. This file documents the available paths
 * exposed by `open-competition-kit.ts`.
 */

/** The shape shared by competitions, users, tracks, enrolments and the rest. */
type CollectionApi = {
  /** Register a collection listener. A no-op placeholder today. */
  on: unknown;
  /** List records matching a partial filter. */
  list: unknown;
  get: unknown;
  create: unknown;
  update: unknown;
  delete: unknown;
  /**
   * The owning resource. Competitions and users have none and fail with
   * `CollectionOwnerError`; tracks resolve to their competition, enrolments to
   * their track.
   */
  owner: unknown;
  /**
   * Records belonging to an owner. Competitions and users return everything;
   * tracks list per competition; enrolments list per user or track.
   */
  of: unknown;
};

export type OpenCompetitionKitApi = {
  outputs: unknown;
  /**
   * Large file storage. Bytes go to the package implementing the `files` hooks;
   * this layer derives the storage key and records ownership, so files can be
   * listed and reclaimed.
   */
  files: {
    /** Claim a key for a file that does not exist yet; may return a presigned URL. */
    reserve: unknown;
    /** Write bytes to an already-reserved key. */
    put: unknown;
    /** Seal a reserved key and produce the `FileRef` to persist. */
    commit: unknown;
    /** Store bytes and return a `FileRef` to persist in the database. */
    write: unknown;
    /** Size, existence, checksum, without fetching the body. */
    peek: unknown;
    /** Stream the bytes back out. */
    read: unknown;
    /** A presigned URL, when the backend supports one. */
    link: unknown;
    /**
     * The largest file the backend will take, or undefined for no ceiling. Ask
     * before uploading: a file turned away here costs nothing.
     */
    limit: unknown;
    delete: unknown;
    /** Find ownership rows by key, owner, or namespace. */
    list: unknown;
    /** Every file belonging to an owner. */
    of: unknown;
    /** Reclaim an owner's files. */
    purge: unknown;
  };
  /**
   * Somewhere to run a command, through the package implementing the `machine`
   * hooks. This layer fills in confinement the caller left out, so a runner that
   * passes no limits still asks for some. The organiser's maximum is separate:
   * written in the `machine:` block and enforced where the confining happens,
   * which is also the only place that knows how much of it is possible.
   */
  machine: {
    /**
     * Make an image exist, from a recipe in the config. Idempotent and cheap on a
     * second call, so a caller may ask at every startup. Inputs never come from a
     * submission, which keeps a participant from choosing the image they are
     * judged in.
     */
    build: unknown;
    /** Run a command somewhere and collect its output. */
    run: unknown;
  };
  secrets: { global: { get: unknown }; user: unknown };
  hooks: {
    /** Load the configured hook package and run a selector against it. */
    do: unknown;
  };

  config: {
    /** The decoded `competition.config.yaml`. */
    get: unknown;
    access: unknown;
    /**
     * Every node an organiser could edit, with the fields each installed package
     * declares there. The editor's half of the extension mechanism: the validator
     * uses the same declarations to decide whether a config boots, so a field that
     * can be set is a field that will be checked.
     */
    describe: unknown;
    /** The resolved path of the file the config was read from. */
    path: unknown;
    /**
     * Whether the config file can be saved to, and why not when it cannot. A
     * file mounted read only is an ordinary way to deploy this, so an editor
     * should ask before it offers to save.
     */
    writable: unknown;
    /**
     * Edited values, keyed by the same dotted paths `describe` reported.
     *
     * Checked against the packages that own the fields, then placed back into
     * `competition.config.yaml` node by node, so the comments and the key order
     * an organiser wrote survive the save. Nothing is written until the edited
     * file has been loaded from scratch and found to start an application.
     *
     * The result says what happened: `accepted` for the values, `stored` for the
     * file, and `reason` when a valid change could not be saved anyway.
     */
    set: unknown;
  };

  /**
   * The process, rather than anything in it.
   *
   * Configuration is read once at startup, so a saved change applies at the next
   * one. `restart` stops this process for whatever runs it to start again;
   * `support` says whether that will work here before anybody offers the button.
   */
  lifecycle: {
    support: unknown;
    restart: unknown;
  };

  enrolments: CollectionApi & {
    /** Enrol a user in a track. Idempotent: an existing enrolment is returned. */
    enrol: unknown;
  };

  submissions: CollectionApi & {
    /**
     * Create a submission through the configured hook. Implementations persist the
     * submission and any initial jobs they want to create.
     */
    submit: unknown;
    /**
     * Whether a user may submit to a track, without submitting. Runs the same gate
     * chain `submit` enforces, so a form can show the reason up front instead of
     * letting someone fill it in and be turned away.
     */
    gate: unknown;
    /**
     * What every installed gate has to say about a track, refusing or not. The half
     * of the chain a page can render when the answer is yes: when the track closes,
     * how many attempts are left. Advisory, so unlike `gate` it is safe to call
     * while a list renders and safe to cache.
     */
    status: unknown;
  };

  jobs: CollectionApi & {
    /** Create pending jobs for an existing submission, without a new submission. */
    createFromSubmission: unknown;
    /** Run a job through the configured runner hook. */
    run: unknown;
  };

  context: CollectionApi & {
    /**
     * Upsert context values for a job/reference pair. Every matching row is
     * updated; if none exist, one is created.
     */
    set: unknown;
    /** Read a required context value, failing when it does not exist. */
    require: unknown;
  };

  users: CollectionApi;
  tracks: CollectionApi;
  competitions: CollectionApi;

  /** Form definitions sourced from track configuration. */
  forms: { get: unknown; load: unknown };

  /** Leaderboard definitions sourced from competition configuration. */
  leaderboards: { get: unknown; load: unknown };
};
