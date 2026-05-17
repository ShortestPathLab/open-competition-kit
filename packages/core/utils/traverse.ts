type Path = Array<string | number>;

export function traverse<T>(
  obj: T,
  f: (value: unknown, path: Path) => unknown,
  path: Path = [],
): T {
  const next = f(obj, path);

  if (next && typeof next === "object") {
    if (Array.isArray(next)) {
      return next.map((value, index) =>
        traverse(value, f, [...path, index]),
      ) as T;
    }

    return Object.fromEntries(
      Object.entries(next).map(([key, value]) => [
        key,
        traverse(value, f, [...path, key]),
      ]),
    ) as T;
  }

  return next as T;
}
