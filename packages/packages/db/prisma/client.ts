import { once } from "lodash-es";
import { PrismaClient } from "./generated/client";

export const client = once(async () => {
  const { PrismaClient } = await import("./generated/client");
  return new PrismaClient();
});
