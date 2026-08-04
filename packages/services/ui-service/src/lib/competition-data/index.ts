/**
 * Reading a competition on behalf of whoever is asking.
 *
 * Four parts, in dependency order: the shapes the UI is handed, the visibility
 * check every read goes through, the summaries themselves, and the counts and
 * per-user lists built on top of them. Split by what each answers rather than
 * by which page asks, because most of them are asked by several.
 */
export type {
  CompetitionSummary,
  EnrolmentSummary,
  SubmissionSummary,
  TrackSummary,
  UserSubmissionSummary,
} from "./types";

export { CompetitionNotFoundError, ensureTrackAvailable } from "./visibility";

export {
  getCompetitionBanner,
  getCompetitionSummary,
  getTrackSummary,
  listCompetitionSummaries,
} from "./summaries";

export {
  countCompetitionEnrolments,
  countCompetitionSubmissions,
  countTrackEnrolments,
  countTrackSubmissions,
} from "./counts";

export { listUserEnrolments, listUserSubmissions } from "./user";
