/**
 * Claiming an organiser address.
 *
 * The account is already signed in and already listed in `admins:`. What is
 * missing is any proof the two belong together, and this is where it is
 * supplied: the operator's token in exchange for `emailVerified` on the account.
 *
 * Two things are required, not one. A leaked token is useless without a session
 * on a listed address, and a session on a listed address is useless without the
 * token, which is what makes this worth having on a deployment where anybody may
 * register any address.
 */
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { adminStatus } from "./admin";
import { adminToken, clearThrottle, throttle, tokenMatches } from "./admin-token.server";
import { authMiddleware } from "./auth-server";
import { auth } from "./get-auth";
import { queryClient } from "@/router";

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "not-listed" | "already-verified" | "throttled" | "bad-token" };

export const claimAdmin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }): Promise<ClaimResult> => {
    const status = await adminStatus();

    // Listedness is checked before the token is even read, so an account that
    // could never be an organiser cannot use this endpoint to find out whether a
    // guess was right.
    if (!status.mayClaim) {
      return { ok: false, reason: status.isAdmin ? "already-verified" : "not-listed" };
    }

    const { allowed } = throttle(session.user.id);
    if (!allowed) return { ok: false, reason: "throttled" };

    if (!tokenMatches(data.token.trim(), await adminToken())) {
      return { ok: false, reason: "bad-token" };
    }

    // The same field a mail confirmation would set. Writing it through
    // better-auth's own adapter rather than with SQL keeps this working if the
    // user table moves, and keeps better-auth's account linking rules reading
    // the value they expect: a verified row is one an OAuth sign-in on the same
    // address is allowed to link into, which is how an organiser who claims
    // today and adds GitHub later ends up with one account rather than two.
    const context = await (await auth()).$context;
    await context.internalAdapter.updateUser(session.user.id, { emailVerified: true });

    clearThrottle(session.user.id);
    return { ok: true };
  });

export const claimMessage = (reason: Exclude<ClaimResult, { ok: true }>["reason"]): string => {
  switch (reason) {
    case "not-listed":
      return "This account is not listed as an organiser. Ask whoever runs the deployment to add your address to admins: in the config.";
    case "already-verified":
      return "This account is already confirmed. Nothing to do here.";
    case "throttled":
      return "Too many attempts. Wait fifteen minutes and try again.";
    case "bad-token":
      return "That token was not accepted. Check the config, or the service logs if the deployment generated one.";
  }
};

export const useClaimAdmin = () => {
  const claim = useServerFn(claimAdmin);
  return useMutation({
    mutationFn: (token: string) => claim({ data: { token } }),
    onSuccess: async (result) => {
      // The navigation bar and every route guard read the admin status, and all
      // of them are now wrong. Refetching beats a reload: the session cookie has
      // not changed, only what the server says about it.
      if (result.ok) await queryClient.invalidateQueries();
    },
  });
};
