import { NoopError, type Package, competitions } from "sdk";

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
  user: {},
  form: { ui: {}, submit: {} },
  runner: { ui: {}, submit: {} },
  track: {
    enrol: {},
  },
  enrolments: {
    enrol: function (a: unknown): Promise<unknown> {
      throw new Error("Function not implemented.");
    },
  },
} satisfies DeepRequired<Package>;
