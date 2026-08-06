/**
 * The secret an organiser presents to prove an address in `admins:` is theirs.
 *
 * `admins:` says which addresses may organise. It does not say that whoever is
 * signed in as one of them actually owns it, and on a deployment offering email
 * and password nothing else does either: sign-up takes an address on trust
 * because there is no mail service to confirm it with. So between the first boot
 * and the organiser registering, the admin address is unclaimed and anybody may
 * take it.
 *
 * The token closes that window without adding infrastructure. Whoever can read
 * the config or the container logs is already the operator, so possession of
 * that string is a real signal about who somebody is, in the same way Jenkins
 * and Grafana use an initial admin password. Presenting it marks the account
 * verified, which is the same flag an email confirmation would set, so this is a
 * second route to the existing state rather than a parallel one.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import sdk, { unsafe } from "@open-competition-kit/sdk";

/**
 * Memoise only a successful read, so a momentary failure to load the config is
 * not cached and returned forever. The same reasoning as `onceOk` in
 * `get-auth.ts`, and kept separate from it because a token that fell back to
 * being generated on every retry would print a different one each time and none
 * of them would be the one the operator copied.
 */
const onceOk = <T>(fn: () => Promise<T>) => {
  let cached: Promise<T> | undefined;
  return () => {
    if (!cached) {
      cached = fn().catch((e) => {
        cached = undefined;
        throw e;
      });
    }
    return cached;
  };
};

/**
 * Where the token comes from, in order: the config, the environment, or a fresh
 * one printed at startup.
 *
 * The generated fallback exists so that `admins:` is never unreachable. A
 * deployment that configures nothing still has exactly one way in, and it is
 * written where only somebody with access to the logs can read it.
 *
 * It lives in memory, so it changes on restart and differs between replicas.
 * That is fine for trying the kit out and wrong for anything long-lived, which
 * is what the message says.
 */
export const adminToken = onceOk(async (): Promise<string> => {
  const config = (await unsafe(sdk.config.get())) as { adminToken?: string };

  const configured = config.adminToken?.trim() || process.env.OCK_ADMIN_TOKEN?.trim();
  if (configured) return configured;

  const generated = randomBytes(24).toString("base64url");
  console.warn(
    `[admin] No adminToken is configured, so one was generated for this process:\n\n` +
      `    ${generated}\n\n` +
      `An organiser listed in admins: enters it at /me/verify to confirm the ` +
      `address is theirs. It is held in memory, so it changes on every restart ` +
      `and differs between replicas. Set adminToken: in the config (usually as ` +
      `\${{ env("OCK_ADMIN_TOKEN") }}) for anything that has to survive one.`,
  );
  return generated;
});

/**
 * Compare without leaking the answer in the timing.
 *
 * Hashed first so both sides are the same length. `timingSafeEqual` throws on a
 * length mismatch, and catching that would put the length of the real token back
 * into the timing, which is the thing being avoided.
 */
export const tokenMatches = (presented: string, actual: string): boolean => {
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(actual).digest();
  return timingSafeEqual(a, b);
};

/** Attempts allowed per account before the claim form stops answering. */
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * A guess limit, per account, per process.
 *
 * In memory on purpose. Storing it would mean a table whose only job is to slow
 * down an attack that already needs a session on a listed address, and a
 * restarting service clearing the count is a worse outcome than not having the
 * count at all only if the token is weak enough to brute force in five tries.
 *
 * The consequence worth naming: several replicas means several counters, so the
 * effective limit is `LIMIT` times the number of them.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export const throttle = (
  key: string,
  now = Date.now(),
): { allowed: boolean; remaining: number } => {
  const entry = attempts.get(key);

  if (!entry || now >= entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT - 1 };
  }

  if (entry.count >= LIMIT) return { allowed: false, remaining: 0 };

  entry.count += 1;
  return { allowed: true, remaining: LIMIT - entry.count };
};

/** Drops the count for an account, called once a claim succeeds. */
export const clearThrottle = (key: string) => attempts.delete(key);

/** Test seam. The map is process-wide and would otherwise leak between tests. */
export const resetThrottle = () => attempts.clear();
