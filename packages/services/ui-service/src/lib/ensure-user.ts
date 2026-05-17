import { createServerFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { z } from "zod";

const ensureUserInput = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
});

export const ensureUserExists = createServerFn({ method: "POST" })
  .inputValidator(ensureUserInput)
  .handler(async ({ data }) => {
    const { created } = await unsafe(
      sdk.users.upsert({ id: data.id, name: data.name }),
    );
    return { success: true, created };
  });
