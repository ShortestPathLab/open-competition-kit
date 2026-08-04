/**
 * How a submission and its runs read on screen.
 *
 * A runner decides what a job's status word is and what shape its result takes, so
 * every page showing either has to make the same guesses. Making them once here is
 * what keeps a track's list, a submission's row, and the detail page from
 * disagreeing about whether `done` means finished.
 */
export * from "./status";
export * from "./values";
export * from "./result";
export * from "./body";
