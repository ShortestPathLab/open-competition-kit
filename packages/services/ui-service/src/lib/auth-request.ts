/**
 * Helpers for calling `authClient` from a form.
 *
 * Neither better-auth's client nor better-fetch wraps its `fetch` call in a
 * try/catch, so a network-level failure (server unreachable, DNS, request
 * aborted) *rejects the promise* instead of reaching the `onError` hook. A form
 * that only handles `onError` never runs its cleanup and sits on "Signing
 * in..." forever. Callers must therefore wrap auth calls in try/catch and pass
 * `authFetchOptions`, so a request that never gets an answer fails instead of
 * hanging.
 */

/** How long an auth request may run before it is aborted and reported failed. */
const AUTH_TIMEOUT_MS = 15_000;

/** Pass as the `fetchOptions` argument of any `authClient` call. */
export const authFetchOptions = { timeout: AUTH_TIMEOUT_MS };

/** Turns a rejected auth request into something worth showing a user. */
export function authRequestErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError") {
    return "The server took too long to respond. Check your connection and try again.";
  }
  return "Couldn't reach the server. Check your connection and try again.";
}
