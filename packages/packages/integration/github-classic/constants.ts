/**
 * The archive goes to the `files` backend rather than being base64'd into a
 * database row, so this cap is a sanity limit rather than a structural one.
 */
export const DEFAULT_MAX_SUBMISSION_ARCHIVE_BYTES = 512 * 1024 * 1024;

export const GITHUB_REF_SELECT_KIND = "github:ref-select";
export const GITHUB_REF_FIELD_KEY = "github:ref";
export const GITHUB_WEB = "https://github.com";

/** The renderer registered under `surface.view`, and the item that asks for it. */
export const REPOSITORY_CARD = "github/repository-card";
