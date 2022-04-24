export const objectMap = (
  obj: object,
  fnK?: (k: unknown) => unknown,
  fnV?: (v: unknown, k?: unknown, i?: unknown) => unknown,
) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v], i) => [
      fnK ? fnK(k) : k,
      fnV ? fnV(v, k, i) : v,
    ]),
  );
