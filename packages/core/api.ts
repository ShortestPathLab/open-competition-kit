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
  secrets: {
    global: { get: unknown };
    user: { get: unknown };
  };
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

  outputs: CollectionApi & {
    /**
     * Upsert output bodies for a job/reference pair.
     *
     * All matching outputs for the given job and reference are updated; if none
     * exist, a new output is created.
     */
    set: unknown;
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
};
