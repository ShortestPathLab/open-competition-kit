import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "src/lib/auth.server";
import sdk from "sdk";

export const storeSignupSecrets = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await ensureSession();
    const userId = session.user.id;
    const userName = session.user.name ?? session.user.email;

    const existing = await sdk.users.get(userId);

    if (!existing.value) {
      await sdk.users.create({
        id: userId,
        name: userName,
        secrets: "{}",
      });
    }

    const result = await sdk.users.storeSecrets(userId, {
      "signed-in": new Date().toISOString(),
    });

    if (result.error) throw result.error;

    return { success: true, secrets: result.value };
  },
);
