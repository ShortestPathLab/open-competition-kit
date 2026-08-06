import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { getAuthSession } from "./auth-server";

export type AdminStatus = {
  signedIn: boolean;
  isAdmin: boolean;
  /** False when the config lists no admins at all — the reason nobody has access. */
  configured: boolean;
  /**
   * Listed in `admins:` but not confirmed yet, so the claim page has something
   * to offer. True only about the caller's own account, so saying it out loud
   * tells them nothing they did not already know about themselves.
   */
  mayClaim: boolean;
};

const listAdmins = async () => {
  const config = await unsafe(sdk.config.get());
  return (config.admins ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
};

/**
 * Being listed is necessary and is not sufficient.
 *
 * `admins:` names an address. Whether the person holding this session owns that
 * address is a separate question, and until something answers it the list is a
 * statement of intent rather than a check: on a deployment offering email and
 * password, sign-up takes any address on trust, so the first person to register
 * an organiser's address gets the dashboard.
 *
 * `emailVerified` is what answers it. A social provider sets it because the
 * provider confirmed the address; presenting the admin token sets it because the
 * operator did. A mail service would be a third route to the same flag, and
 * nothing here would change to accommodate it.
 */
export const decideAdminStatus = (
  user: { email?: string | null; emailVerified?: boolean | null } | null,
  admins: readonly string[],
): AdminStatus => {
  const email = user?.email?.trim().toLowerCase();

  const listed = !!email && admins.includes(email);
  const verified = user?.emailVerified === true;

  return {
    signedIn: !!user,
    configured: admins.length > 0,
    isAdmin: listed && verified,
    mayClaim: listed && !verified,
  };
};

export const adminStatus = createServerOnlyFn(async (): Promise<AdminStatus> => {
  const [session, admins] = await Promise.all([getAuthSession(), listAdmins()]);
  return decideAdminStatus(session?.user ?? null, admins);
});

/**
 * The real access boundary for anything organiser-only.
 *
 * Route guards only decide what gets *rendered* — every `createServerFn` is a
 * public HTTP endpoint that anyone can call directly, so each one that returns
 * organiser data has to check for itself.
 */
export const ensureAdmin = createServerOnlyFn(async () => {
  const status = await adminStatus();
  if (!status.isAdmin) throw new Error("Forbidden");
  return status;
});

export const getAdminStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminStatus> => adminStatus(),
);
