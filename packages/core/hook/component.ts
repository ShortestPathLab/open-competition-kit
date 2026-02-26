import { Schema as S } from "effect";

export type Source = {
  type: "open-competition-kit/hook/component-source";
  source: string;
};

export const componentSource = S.declare(
  (input): input is () => Promise<Source> => typeof input === "function",
);
