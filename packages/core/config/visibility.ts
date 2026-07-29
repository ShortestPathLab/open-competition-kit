/**
 * Whether a competition is public yet.
 *
 * Import-free for the same reason as `./window`: the server decides who may see
 * a draft and the browser decides how to label one, and a single statement of
 * the rule is the only way those two stay in agreement.
 */

export type Visibility = "draft" | "published";

/** Anything a competition config or summary can be, as far as this rule cares. */
export type HasVisibility = { readonly visibility?: string | undefined };

/**
 * Absence means published. Every competition configured before this field
 * existed has no `visibility`, and none of them should disappear on upgrade.
 */
export const isDraft = (competition: HasVisibility) =>
  competition.visibility === "draft";

/**
 * A draft belongs to its organisers.
 *
 * `isAdmin` is the caller's, resolved from the session against the `admins` list
 * — never taken from the client. This function only states the rule; deciding
 * who the caller is stays with whoever holds the session.
 */
export const isVisibleTo = (competition: HasVisibility, isAdmin: boolean) =>
  isAdmin || !isDraft(competition);
