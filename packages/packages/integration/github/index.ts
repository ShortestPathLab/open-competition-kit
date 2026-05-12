import { App } from "@octokit/app";
import { once } from "es-toolkit";
import { kit, unsafe, type Package } from "sdk";
const app = once(async () => {
  new App({
    appId: await unsafe(kit.secrets.global.get("GITHUB_APP_ID")),
    privateKey: await unsafe(kit.secrets.global.get("GITHUB_PRIVATE_KEY")),
  });
});

export default {
  form: {
    loader: async ({ def }, next) => {
      return (await next?.({ def })) ?? { def };
    },
  },
  runner: {
    run: async ({ job }, next) => {
      // Load code here
      return await next?.({ job });
    },
  },
} satisfies Package;
