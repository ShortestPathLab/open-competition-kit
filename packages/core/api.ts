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
