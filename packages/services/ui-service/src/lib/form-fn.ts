import { createServerFn } from "@tanstack/react-start";
import sdk, { unsafe, type $props } from "@open-competition-kit/sdk";
import { z } from "zod";
import { ensureAuthSession } from "./auth.server";
import { resolveId } from "./configure-user";

export const getLoadedForm = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: trackId }) => {
    const session = await ensureAuthSession();
    return (await unsafe(
      sdk.forms.load(trackId, resolveId(session.user)),
    )) as (typeof $props.form.ui)["def"];
  });
