import { type Package } from "@open-competition-kit/sdk";
import { config } from "./config";
import { db } from "./db";

const getCollection = async (collection: string) => {
  const a = await db();
  if (collection in a) {
    // Cast to a representative type for general type checking
    // This is a workaround for the way Prisma generates types
    // This won't work if the typings haven't generated
    return a[collection as keyof typeof a] as (typeof a)["user"];
  }
  throw new Error("Collection not found");
};

export default {
  name: "@open-competition-kit/db-prisma",
  config,
  description:
    "Provides the Open Competition Kit database hooks backed by Prisma and the generated Prisma client.",
  version: "0.0.6",
  db: {
    get: async ({ collection, payload }) => {
      const a = await getCollection(collection);
      return a.findFirstOrThrow({ where: { id: payload } });
    },
    list: async ({ collection, payload }) => {
      const a = await getCollection(collection);
      return a.findMany({ where: payload });
    },
    create: async ({ collection, payload }) => {
      const a = await getCollection(collection);
      return await a.create({ data: payload });
    },
    update: async ({ collection, payload }) => {
      const a = await getCollection(collection);
      await a.update({ where: { id: payload.id }, data: payload });
    },
    delete: async ({ collection, payload }) => {
      const a = await getCollection(collection);
      await a.delete({ where: { id: payload } });
    },
    /**
     * Compare-and-set, as one statement the database settles.
     *
     * `updateMany` rather than `update` because `update` takes a unique filter
     * only, so the guard could not be part of it: reading the row, checking it,
     * then writing leaves a window that two runner services will find. Postgres
     * takes a row lock for the duration of the `UPDATE`, so of two callers
     * racing on the same row exactly one sees a count of 1.
     */
    claim: async ({ collection, payload }) => {
      const a = await getCollection(collection);
      const { count } = await a.updateMany({
        where: { id: payload.id, ...payload.where },
        data: payload.set,
      });
      return count === 1;
    },
  },
} satisfies Package;
