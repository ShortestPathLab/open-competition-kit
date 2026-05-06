import { type Package } from "sdk";

type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;

const noop = async () => {
  return undefined as never;
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
  form: { ui: noop, submit: {} },
  runner: { ui: {}, submit: {} },
  track: {
    enrol: {},
  },
  leaderboard: { ui: noop },
  enrolments: {
    enrol: noop,
  },
} satisfies DeepRequired<Package>;
