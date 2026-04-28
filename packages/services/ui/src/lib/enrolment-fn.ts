import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { listUserEnrolments } from "./competition-data";
import { z } from "zod";
import sdk, { unsafe } from "sdk";

const userEnrolmentsInput = z.string();

const getUserEnrolments = createServerFn({ method: "GET" })
  .inputValidator(userEnrolmentsInput)
  .handler(async ({ data: userId }) => {
    return listUserEnrolments(userId);
  });

export function useUserEnrolments(userId?: string) {
  const getUserEnrolmentsFn = useServerFn(getUserEnrolments);
  return useQuery({
    queryKey: ["myEnrolments", userId],
    queryFn: userId ? () => getUserEnrolmentsFn({ data: userId }) : skipToken,
  });
}
const enrolmentInput = z.object({
  userId: z.string(),
  competitionId: z.string(),
  trackId: z.string(),
});

export const getEnrollmentStatus = createServerFn({ method: "GET" })
  .inputValidator(enrolmentInput)
  .handler(({ data }) =>
    unsafe(
      sdk.enrolments.isEnrolled(data.userId, data.competitionId, data.trackId),
    ),
  );
