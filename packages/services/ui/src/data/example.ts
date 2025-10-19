import { createServerFn } from "@tanstack/react-start";
import { competitions } from "sdk";

export const getExample = createServerFn({
  method: "GET",
}).handler(async () => {
  const result = await competitions.list();
  return result.value;
});
