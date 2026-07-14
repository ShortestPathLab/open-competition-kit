import { createServerOnlyFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { getAuthSession } from "./auth.server";
import { adminStatus } from "./admin";

/** Files staged by a participant belong to that participant until a submission claims them. */
export const UPLOAD_NAMESPACE = "open-competition-kit/namespace/user" as const;

export const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;

export const maxUploadBytes = createServerOnlyFn(async () => {
  const config = await unsafe(sdk.config.get());
  const limit = (config.largeFiles as { maxBytes?: number } | undefined)
    ?.maxBytes;
  return typeof limit === "number" && limit > 0 ? limit : DEFAULT_MAX_BYTES;
});

export const requireUser = createServerOnlyFn(async () => {
  const session = await getAuthSession();
  if (!session?.user?.id) throw new Response("Unauthorized", { status: 401 });
  return session.user;
});

/**
 * A file may only be touched by the participant it belongs to, or by an organiser.
 *
 * Keys are unguessable, but "unguessable" is not an access control policy — and
 * these endpoints take a key straight from the request.
 */
export const requireOwnedFile = createServerOnlyFn(async (key: string) => {
  const user = await requireUser();
  const [row] = await unsafe(sdk.files.list({ key }));

  if (!row) throw new Response("Not found", { status: 404 });

  if (row.owner !== user.id) {
    const { isAdmin } = await adminStatus();
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
  }

  return { row, user };
});
