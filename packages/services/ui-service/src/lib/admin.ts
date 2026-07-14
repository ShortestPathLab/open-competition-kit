import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { getAuthSession } from "./auth.server";

export type AdminStatus = {
  signedIn: boolean;
  isAdmin: boolean;
  /** False when the config lists no admins at all — the reason nobody has access. */
  configured: boolean;
};

const listAdmins = async () => {
  const config = await unsafe(sdk.config.get());
  return (config.admins ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
};

export const adminStatus = createServerOnlyFn(async (): Promise<AdminStatus> => {
  const [session, admins] = await Promise.all([getAuthSession(), listAdmins()]);
  const email = session?.user?.email?.trim().toLowerCase();

  return {
    signedIn: !!session,
    configured: admins.length > 0,
    isAdmin: !!email && admins.includes(email),
  };
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
