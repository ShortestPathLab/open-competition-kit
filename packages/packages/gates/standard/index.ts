import { type Package } from "@open-competition-kit/sdk";
import { config } from "./config";
import { standardRefusals, standardReports } from "./gates-impl";

export * from "./config";
export * from "./gates-impl";

export default {
  name: "@open-competition-kit/gates-standard",
  description:
    "Refuses submissions outside a track's window, past its attempt ceiling, or faster than its rate limit.",
  version: "0.0.11",
  config,
  submissions: {
    /**
     * Additive, like every gate. Ours are appended to whatever the packages
     * further out decided and the combined list is passed inward, so installing a
     * gate of your own never displaces these.
     */
    gate: async ({ user, track, refusals }, next) => {
      const all = [...refusals, ...(await standardRefusals(user, track, Date.now()))];
      return (await next?.({ user, track, refusals: all })) ?? all;
    },
    /**
     * The same three rules, reported rather than enforced. Additive in the same
     * way, so a package adding a gate adds a report beside these.
     */
    status: async ({ track, user, reports }, next) => {
      const all = [...reports, ...(await standardReports(track, user, Date.now()))];
      return (await next?.({ track, user, reports: all })) ?? all;
    },
  },
} satisfies Package;
