export const arrayAvg = (arr: number[]) =>
  arr.reduce((acc, val) => acc + val, 0) / arr.length;

export const enforceArray = (v: unknown | unknown[]) =>
  Array.isArray(v) ? v : v ? [v] : [];
