/**
 * IntelliSense-only description of the Open Competition Kit service object.
 *
 * The concrete endpoint signatures are intentionally left as `unknown`; the SDK
 * overlays the real Effect-to-Promise mapping at runtime. Keep this file focused
 * on documenting the available paths exposed by `open-competition-kit.ts`.
 */

/**
 * Common collection API exposed for competitions, users, tracks, and enrolments.
 */
type CollectionApi = {
  /**
   * Register a collection hook/listener.
   *
   * Currently backed by a no-op placeholder in the core service.
   */
  on: unknown;

  /**
   * List records in this collection.
   *
   * The implementation accepts a partial record filter and returns matching
   * records from the configured database hook.
   */
  list: unknown;

  /**
   * Get a single record by ID.
   */
  get: unknown;

  /**
   * Create a record in this collection.
   */
  create: unknown;

  /**
   * Update a record in this collection.
   */
  update: unknown;

  /**
   * Delete a record from this collection by ID.
   */
  delete: unknown;

  /**
   * Resolve the owning resource for a record.
   *
   * Competitions and users do not have owners and fail with
   * `CollectionOwnerError`; tracks resolve to their competition, and enrolments
   * resolve to their track.
   */
  owner: unknown;

  /**
   * List records belonging to an owner.
   *
   * Competitions and users return all records. Tracks can be listed for a
   * competition. Enrolments can be listed for a user or track.
   */
  of: unknown;
};

export type OpenCompetitionKitApi = {
  outputs: unknown;
  /**
   * Large file storage.
   *
   * Bytes go to the package implementing the `files` hooks; this layer derives
   * the storage key and records ownership, so files can be listed and reclaimed.
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
    /** Size / existence / checksum, without fetching the body. */
    peek: unknown;
    /** Stream the bytes back out. */
    read: unknown;
    /** A presigned URL, when the backend supports one. */
    link: unknown;
    /**
     * The largest file the backend will take, in bytes, or undefined for no
     * ceiling. Ask before uploading: a file turned away here costs nothing.
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
   * Running untrusted code.
   *
   * Goes to the package implementing the `sandbox` hooks. This layer fills in
   * confinement the caller left out, so a runner that passes no limits still
   * gets some. The organiser's maximum is a separate thing and lives with the
   * package: it is written in the `sandbox:` block, declared by whichever
   * package reads it, and enforced where the confining actually happens.
   */
  sandbox: {
    /** Run a command in an isolated environment and collect its output. */
    run: unknown;
  };
  secrets: { global: { get: unknown }; user: unknown };
  /**
   * Hook package access.
   */
  hooks: {
    /**
     * Load the configured hook package, run a selector against it, and return the
     * selected hook result.
     */
    do: unknown;
  };

  /**
   * Runtime competition-kit configuration.
   */
  config: {
    /**
     * Return the decoded `competition.config.yaml` configuration.
     */
    get: unknown;
    access: unknown;
    /**
     * Describe every node an organiser could edit, with the fields each
     * installed package declares there.
     *
     * The editor's half of the extension mechanism. The validator uses the same
     * declarations to decide whether a config boots, so a field that can be set
     * is a field that will be checked.
     */
    describe: unknown;
  };

  /**
   * Competition enrolments connecting users to tracks.
   */
  enrolments: CollectionApi & {
    /**
     * Enrol a user in a track.
     *
     * This is idempotent: if an enrolment already exists for the user and track,
     * the existing record is returned.
     */
    enrol: unknown;
  };

  submissions: CollectionApi & {
    /**
     * Create a submission through the configured runner submission hook.
     *
     * Hook implementations are responsible for persisting the submission and any
     * initial jobs they want to create.
     */
    submit: unknown;
    /**
     * Ask whether a user may submit to a track, without submitting.
     *
     * Runs the same gate chain `submit` enforces, so a form can show the reason
     * up front instead of letting someone fill it in and be turned away.
     */
    gate: unknown;
    /**
     * What every installed gate has to say about a track, whether or not it is
     * refusing.
     *
     * The half of the gate chain a page can render when the answer is yes: when
     * the track closes, how many attempts are left. Advisory, so unlike `gate`
     * it is safe to call while a list renders and safe to cache.
     */
    status: unknown;
  };

  jobs: CollectionApi & {
    /**
     * Create pending jobs for an existing submission.
     *
     * This is an infrastructure convenience for re-running an existing
     * submission without creating a new submission record.
     */
    createFromSubmission: unknown;

    /**
     * Run a job through the configured runner hook.
     *
     * Hook implementations may update job state and write outputs as needed.
     */
    run: unknown;
  };

  context: CollectionApi & {
    /**
     * Upsert context values for a job/reference pair.
     *
     * All matching context rows for the given job and reference are updated; if
     * none exist, a new context row is created.
     */
    set: unknown;

    /**
     * Read a required context value for a job/reference pair and throw if it
     * does not exist.
     */
    require: unknown;
  };

  /**
   * Users participating in competitions.
   */
  users: CollectionApi;

  /**
   * Tracks belonging to competitions.
   */
  tracks: CollectionApi;

  /**
   * Competitions in this system.
   */
  competitions: CollectionApi;

  /**
   * Form definitions sourced from track configuration.
   */
  forms: { get: unknown; load: unknown };

  /**
   * Leaderboard definitions sourced from competition configuration.
   */
  leaderboards: { get: unknown; load: unknown };
};
