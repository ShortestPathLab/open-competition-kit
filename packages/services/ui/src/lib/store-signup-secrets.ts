import { createServerFn } from "@tanstack/react-start";
import { ensureAuthSession } from "src/lib/auth.server";
import sdk from "sdk";

export const storeSignupSecrets = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await ensureAuthSession();
    const userId = session.user.id;
    const userName = session.user.name ?? session.user.email;

    const existing = await sdk.users.get(userId);

    if (!existing.value) {
      await sdk.users.create({
        id: userId,
        name: userName,
      });
    }

    const result = await sdk.secrets.user.set({
      owner: userId,
      reference: "signed-in",
      value: new Date().toISOString(),
    });

    if (result.error) throw result.error;

    return { success: true, context: result.value.context };
  },
);
