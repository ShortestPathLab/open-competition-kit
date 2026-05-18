import sdk, { unsafe, type $props } from "@open-competition-kit/sdk";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "./auth.server";
import { resolveId } from "./configure-user";

export const getLoadedForm = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .middleware([authMiddleware])
  .handler(async ({ data: trackId, context: { session } }) => {
    return (await unsafe(
      sdk.forms.load(trackId, resolveId(session.user)),
    )) as (typeof $props.form.ui)["def"];
  });
