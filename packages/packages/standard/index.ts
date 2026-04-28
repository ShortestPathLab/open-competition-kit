import { type Package, enrolments, hooks, unsafe } from "sdk";

export default {
  enrolments: {
    enrol: async (args, next) => {
      await next?.(args);
      const existing = await unsafe(enrolments.list(args));
      return (existing[0] ?? (await unsafe(enrolments.create(args)))).id;
    },
  },
} satisfies Package;
