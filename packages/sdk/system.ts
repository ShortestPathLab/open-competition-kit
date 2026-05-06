export const isBrowserLike = () => {
  return typeof (globalThis as typeof globalThis & { window?: unknown }).window !==
    "undefined";
};
