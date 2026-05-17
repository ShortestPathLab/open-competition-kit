import { createServerFn } from "@tanstack/react-start";
import { Account, User } from "better-auth";
import { secrets, unsafe, users } from "@open-competition-kit/sdk";
import { auth } from "./get-auth";
export const resolveId = (u: User) => u.email;

export const configureUser = createServerFn()
  .inputValidator((c: { account?: Account; user: User; method: string }) => c)
  .handler(async ({ data: { user, method, account } }) => {
    const id = resolveId(user);
    await unsafe(users.upsert({ id, name: user.name }));
    await secrets.user.set({
      owner: id,
      reference: "auth/signed-in",
      value: new Date().toISOString(),
    });
    if (method !== "email") {
      const token = await (
        await auth()
      ).api.getAccessToken({ body: { providerId: method, userId: user.id } });
      await secrets.user.set({
        owner: id,
        reference: `auth/${method}/token`,
        value: token.accessToken,
      });
      if (token.accessTokenExpiresAt) {
        await secrets.user.set({
          owner: id,
          reference: `auth/${method}/token/expiry`,
          value: token.accessTokenExpiresAt.toISOString(),
        });
      }
    }
    if (account) {
      await secrets.user.set({
        owner: id,
        reference: `auth/${method}/id`,
        value: account.accountId,
      });
    }
  });
