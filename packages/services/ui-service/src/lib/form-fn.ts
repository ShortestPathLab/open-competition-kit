import { createServerFn } from "@tanstack/react-start";
import sdk, { unsafe, type $props } from "sdk";
import { z } from "zod";

export const getLoadedForm = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: trackId }) => {
    return (await unsafe(
      sdk.forms.load(trackId, "anonymous"),
    )) as (typeof $props.form.ui)["def"];
  });
