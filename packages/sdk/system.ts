declare global {
  const window: unknown;
}

export const isBrowserLike = () => {
  return typeof window !== "undefined";
};
