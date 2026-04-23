import { createServerFn } from "@tanstack/react-start";
import sdk from "sdk";

export const ensureUserExists = createServerFn({ method: "POST" }).handler(
  async (ctx: any) => {
    const data = ctx.data as { id: string; email: string; name: string };
    try {
      const existing = await sdk.users.get(data.id);
      if (existing.value) {
        await sdk.users.update({
          id: data.id,
          name: data.name,
          secrets: existing.value.secrets,
        });
        return { success: true, created: false };
      }
    } catch (e) {
      // If it throws, we assume it doesn't exist
    }

    await sdk.users.create({
      id: data.id,
      name: data.name,
      secrets: "{}",
    });

    return { success: true, created: true };
  },
);
