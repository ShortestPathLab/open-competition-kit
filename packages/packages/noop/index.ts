import { type Package } from "@open-competition-kit/sdk";

type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;

const noop = async () => {
  return undefined as never;
};

export default {
  db: { list: noop, get: noop, create: noop, update: noop, delete: noop },
  user: {},
  form: { loader: noop, ui: noop, submit: {} },
  submissions: { submit: noop },
  runner: { ui: {}, run: noop, setup: noop, teardown: noop },
  track: { enrol: {} },
  leaderboard: { ui: noop, loader: noop },
  enrolments: { enrol: noop },
} satisfies DeepRequired<Package>;
