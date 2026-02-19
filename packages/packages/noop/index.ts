import { NoopError, type Package,competitions } from "sdk";

type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;

const noop = async () => {
  throw new NoopError();
};

export default {
  db: {
    list: noop,
    get: noop,
    create: noop,
    update: noop,
    delete: noop,
  },
  collections: {
    competitions: {
      get: ()=>,
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
    enrolments: {
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
  track: {},
  enrolments: {},
} satisfies DeepRequired<Package>;
