export const stem = "open-competition-kit/tag" as const;

/**
 * The reference a job output is stored under.
 *
 * Every output goes under the stem, so a runner and the board that reads it
 * agree on one name without either having to spell it out. A bare name written
 * straight into `outputs.set` collides with any other package that picks the
 * same word, and a board pointed at the other spelling reads nothing and
 * renders empty with no error to explain it.
 */
export const output = <T extends string>(name: T) => `${stem}/output/${name}` as const;

/**
 * A collection of standard reference codes recommended for
 * cross-compatibility.
 */
export const std = {
  /**
   * The output a leaderboard reads unless its `output:` names another.
   *
   * A runner writes the values it wants ranked here: a scalar, an object of
   * them, or an array of either.
   */
  output: output("default"),

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
