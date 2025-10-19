export type OpenCompetitionKitApi = {
  /**
   * The competitions in this system
   */
  competitions: {
    /**
     * Gets a competition by ID.
     * @param id The ID of the competition
     */
    get: unknown;

    /**
     * Lists all competitions.
     */
    list: unknown;
  };
};
