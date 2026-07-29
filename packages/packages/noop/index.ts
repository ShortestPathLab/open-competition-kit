import { type Package } from "@open-competition-kit/sdk";

type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;

const noop = async () => {
  return undefined as never;
};

export default {
  name: "@open-competition-kit/noop",
  description:
    "Provides a complete no-op package surface for development, testing, and placeholder hook chains.",
  version: "0.0.6",
  db: { list: noop, get: noop, create: noop, update: noop, delete: noop },
  files: { write: noop, read: noop, peek: noop, delete: noop, link: noop },
  sandbox: { run: noop },
  user: {},
  form: { loader: noop, ui: noop, submit: {} },
  submissions: { submit: noop, gate: noop },
  runner: { ui: {}, run: noop, setup: noop, teardown: noop },
  track: { enrol: {} },
  leaderboard: { ui: noop, loader: noop },
  enrolments: { enrol: noop },
} satisfies DeepRequired<Package>;
