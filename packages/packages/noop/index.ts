import { type Package } from "sdk";

type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;

const noop = async () => {
  throw new Error("No implementation exists");
};

export default {
  db: {
    competitions: {
      get: noop,
      list: noop,
      create: noop,
      update: noop,
      delete: noop,
    },
    tracks: {
      get: noop,
      list: noop,
      create: noop,
      update: noop,
      delete: noop,
    },
    users: {
      get: noop,
      list: noop,
      create: noop,
      update: noop,
      delete: noop,
    },
  },
  auth: {},
  user: {},
  form: { ui: {}, submit: {} },
  runner: { ui: {}, submit: {} },
} satisfies DeepRequired<Package>;
