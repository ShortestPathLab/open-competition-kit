export const stem = "open-competition-kit/tag" as const;

/**
 * A collection of standard reference codes recommended for
 * cross-compatibility.
 */
export const std = {
  /**
   * A `FileRef` pointing at the zipped code submission.
   *
   * Prefer this. The bytes live in the `files` backend, so the archive can be
   * streamed and can be far larger than a database row.
   */
  submissionSource: `${stem}/submission-source`,

  /**
   * Should contain base-64 encoded zip of the entire code submission.
   *
   * @deprecated Superseded by {@link submissionSource}. Base64 in a database row
   * inflates by a third, cannot be streamed, and bloats every backup — which is
   * why it carried a 10MB cap. Runners should read `submissionSource` first and
   * fall back to this only for jobs created before the migration.
   */
  submissionSourceCodeZipB64: `${stem}/submission-source-code-zip-b64`,
} as const;
