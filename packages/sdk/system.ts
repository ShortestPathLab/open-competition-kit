export const isBrowserLike = () => {
  return typeof globalThis.window !== "undefined";
};
