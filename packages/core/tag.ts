export const stem = "open-competition-kit/tag" as const;

/**
 * A collection of standard reference codes recommended for
 * cross-compatibility.
 */
export const std = {
  /**
   * Should contain base-64 encoded zip of the entire code submission.
   */
  submissionSourceCodeZipB64: `${stem}/submission-source-code-zip-b64`,
} as const;
