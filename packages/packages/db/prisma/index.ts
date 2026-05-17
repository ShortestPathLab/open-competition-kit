import { type Package } from "@open-competition-kit/sdk";
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
  },
} satisfies Package;
