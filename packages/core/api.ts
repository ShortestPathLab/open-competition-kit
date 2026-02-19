import type { Hooks } from "./hook";

export type OpenCompetitionKitApi = {
  hooks: Hooks;
  config: {
    get: unknown;
  };
  enrolments: {};
  users: {};
  tracks: {};
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
    create: unknown;
  };
};
