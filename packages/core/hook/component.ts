import { Schema as S } from "effect";

export type Source<TProps = any> = {
  $inferProps?: TProps;
  type: "open-competition-kit/hook/component-source";
  source: string;
};

export function componentSource<TProps = any>() {
  return S.declare(
    (input): input is () => Promise<Source<TProps>> =>
      typeof input === "function",
  );
}
