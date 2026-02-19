import { once } from "lodash-es";

export const client = once(async (adapter: any) => {
  const { PrismaClient } = await import("./generated/client");
  return new PrismaClient({
    adapter,
  });
});
