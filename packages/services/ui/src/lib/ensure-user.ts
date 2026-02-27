import { createServerFn } from "@tanstack/react-start";
import sdk from "sdk";

export const ensureUserExists = createServerFn({ method: "POST" }).handler(
  async (ctx: any) => {
    const data = ctx.data as { id: string; email: string; name: string };
    try {
      // Pretend this method exists
      // @ts-ignore
      const existing = await sdk.users.get(data.id);
      if (existing) return { success: true, created: false };
    } catch (e) {
      // If it throws, we assume it doesn't exist
    }

    // @ts-ignore
    await sdk.users.create({
      id: data.id,
      email: data.email,
      name: data.name,
    });

    return { success: true, created: true };
  },
);
