import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { listUserEnrolments } from "./competition-data";
import { z } from "zod";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { authMiddleware } from "./auth-server";
import { resolveId } from "./configure-user";

/**
 * The kit and better-auth key users differently: the kit uses whatever
 * `resolveId` returns, better-auth uses its own opaque `session.user.id`. Only
 * one of those matches the `user` column on an enrolment, so the id has to come
 * from the session here. Taking it from the client asked the kit for a user that
 * does not exist (an empty list) and let a caller name someone else's id.
 */
const getUserEnrolments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context: { session } }) =>
    listUserEnrolments(resolveId(session.user)),
  );

/**
 * `sessionUserId` never reaches the server. It separates one signed-in user's
 * cached enrolments from the next's, and holds the query back until the session
 * has loaded.
 */
export function useUserEnrolments(sessionUserId?: string) {
  const getUserEnrolmentsFn = useServerFn(getUserEnrolments);
  return useQuery({
    queryKey: ["myEnrolments", sessionUserId],
    queryFn: sessionUserId ? () => getUserEnrolmentsFn() : skipToken,
  });
}

const enrolmentInput = z.object({ trackId: z.string() });

export const getEnrollmentStatus = createServerFn({ method: "GET" })
  .inputValidator(enrolmentInput)
  .middleware([authMiddleware])
  .handler(({ data, context: { session } }) =>
    unsafe(sdk.enrolments.isEnrolled(resolveId(session.user), data.trackId)),
  );
