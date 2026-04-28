import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { getCompetitionSummary } from "./competition-data";
import { z } from "zod";

const getCompetition = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    return await getCompetitionSummary(id);
  });

export function useCompetition(id?: string) {
  const getCompetitionFn = useServerFn(getCompetition);
  return useQuery({
    queryKey: ["competition", id],
    queryFn: id ? () => getCompetitionFn({ data: id }) : skipToken,
  });
}
