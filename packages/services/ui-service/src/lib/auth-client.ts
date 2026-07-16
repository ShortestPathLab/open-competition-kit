import { createAuthClient } from "better-auth/react";

/**
 * Deliberately no `baseURL`: better-auth then calls the origin the page was
 * served from, which is correct on any port and in any environment.
 *
 * It used to spread in the shared server config, whose `baseURL` fell back to
 * `http://localhost:3007` — the port docker-compose publishes. The browser has
 * no `process.env.BASE_URL` to override that, so every auth request went to 3007
 * no matter where the app was actually running. Against a dev server on any
 * other port that is ERR_CONNECTION_REFUSED before the request ever reaches the
 * server — which looks exactly like "auth is broken and logs nothing".
 */
export const authClient = createAuthClient();
