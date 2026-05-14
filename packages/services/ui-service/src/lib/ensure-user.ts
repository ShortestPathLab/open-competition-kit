import { createServerFn } from "@tanstack/react-start";
import sdk from "sdk";
import { z } from "zod";

const ensureUserInput = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

export const ensureUserExists = createServerFn({ method: "POST" })
  .inputValidator(ensureUserInput)
  .handler(async ({ data }) => {
    try {
      const existing = await sdk.users.get(data.id);
      if (existing.value) {
        await sdk.users.update({
          id: data.id,
          name: data.name,
        });
        return { success: true, created: false };
      }
    } catch (e) {
      // If it throws, we assume it doesn't exist
    }

    await sdk.users.create({
      id: data.id,
      name: data.name,
    });

    return { success: true, created: true };
  });
