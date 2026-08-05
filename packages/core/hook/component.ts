import { Schema as S } from "effect";
import { withMode } from "./mode";

export type Source<TProps = any> = {
  $inferProps?: TProps;
  type: "open-competition-kit/hook/component-source";
  source: string;
};

/**
 * Marked `override` because it takes no arguments and so has nowhere to receive a
 * `next`. The last package listed supplies the component and the ones beneath it
 * are not consulted, which is what `surface.view` in `./index` describes as the
 * reason it is a chained lookup rather than one of these.
 */
export function componentSource<TProps = any>() {
  return withMode(
    S.declare((input): input is () => Promise<Source<TProps>> => typeof input === "function"),
    "override",
  );
}

export type InferProps<T> = T extends () => Promise<Source<infer R>> ? R : never;
