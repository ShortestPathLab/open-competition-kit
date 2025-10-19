import { type Package } from "sdk";
import { db } from "./db";

const c = async () => (await db()).competition;

const t = async () => (await db()).track;

const u = async () => (await db()).user;

export default {
  db: {
    competitions: {
      get: async (id) => await (await c()).findFirstOrThrow({ where: { id } }),
      list: async () => await (await db()).competition.findMany(),
      create: async (partial) => {
        const store = await c();
        return await store.create({
          data: { name: "", ...partial },
        });
      },
      update: async (partial) => {
        const store = await c();
        await store.update({
          where: { id: partial.id },
          data: partial,
        });
      },
      delete: async (id) => {
        const store = await c();
        await store.delete({ where: { id } });
      },
    },
    tracks: {
      get: async (id) => await (await t()).findFirstOrThrow({ where: { id } }),
      list: async () => await (await t()).findMany(),
      create: async ({ competition, ...partial }) => {
        const store = await t();
        if (!competition) throw new Error("No competition");
        return await store.create({
          data: { name: "", ...partial, competition },
        });
      },
      update: async (partial) => {
        const store = await t();
        await store.update({
          where: { id: partial.id },
          data: partial,
        });
      },
      delete: async (id) => {
        const store = await t();
        await store.delete({ where: { id } });
      },
    },
    users: {
      get: async (id) => await (await u()).findFirstOrThrow({ where: { id } }),
      list: async () => await (await u()).findMany(),
      create: async (partial) => {
        const store = await u();
        return await store.create({
          data: { name: "", ...partial },
        });
      },
      update: async (partial) => {
        const store = await u();
        await store.update({
          where: { id: partial.id },
          data: partial,
        });
      },
      delete: async (id) => {
        const store = await u();
        await store.delete({ where: { id } });
      },
    },
  },
} satisfies Package;
