import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import {
  countCompetitionEnrolments,
  countCompetitionSubmissions,
  getCompetitionSummary,
} from "./competition-data";
import { z } from "zod";

const getCompetition = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    return await getCompetitionSummary(id);
  });

const getCompetitionSubmissionCount = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    return await countCompetitionSubmissions(id);
  });

const getCompetitionEnrolmentCount = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    return await countCompetitionEnrolments(id);
  });

export function useCompetition(id?: string) {
  const getCompetitionFn = useServerFn(getCompetition);
  return useQuery({
    queryKey: ["competition", id],
    queryFn: id ? () => getCompetitionFn({ data: id }) : skipToken,
  });
}

/**
 * The competition's total submission count, not the caller's own.
 *
 * Kept separate from `useCompetition` rather than folded into the summary: the
 * count moves every time somebody submits, while the rest of the summary comes
 * from config and barely changes, so sharing a cache entry would mean either a
 * stale number or refetching the whole competition to update one integer.
 */
export function useCompetitionSubmissionCount(id?: string) {
  const getCount = useServerFn(getCompetitionSubmissionCount);
  return useQuery({
    queryKey: ["competition-submission-count", id],
    queryFn: id ? () => getCount({ data: id }) : skipToken,
  });
}

/** How many entries the competition has taken, for the same reasons as above. */
export function useCompetitionEnrolmentCount(id?: string) {
  const getCount = useServerFn(getCompetitionEnrolmentCount);
  return useQuery({
    queryKey: ["competition-enrolment-count", id],
    queryFn: id ? () => getCount({ data: id }) : skipToken,
  });
}
