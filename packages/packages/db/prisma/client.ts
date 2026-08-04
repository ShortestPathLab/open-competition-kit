import { once } from "es-toolkit";

export const client = once(async (adapter: any) => {
  const { PrismaClient } = await import("./generated/client");
  return new PrismaClient({
    adapter,
  });
});
