/**
 * Server-side auth config. Not for the client — the browser must talk to its own
 * origin, so `auth-client.ts` deliberately sets no `baseURL`.
 *
 * `baseURL` is the public, absolute URL better-auth uses when it has to build a
 * link it cannot infer — OAuth callbacks above all. Left unset, better-auth
 * derives it from the incoming request, which keeps it correct on whatever port
 * you happen to be running. Set `BASE_URL` in production, where the public URL
 * is not something a request header can be trusted to tell you.
 *
 * It used to default to `http://localhost:3007`. That is the port docker-compose
 * publishes, so the default was wrong for every other way of running the app.
 */
export const sharedConfig = {
  baseURL: process.env.BASE_URL,
};
