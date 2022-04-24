export const roundFloat = (num: number, decimalPlaces = 0) => {
  const p = Math.pow(10, decimalPlaces);
  const n = num * p * (1 + Number.EPSILON);
  return Math.round(n) / p;
};

export const clamp = (val: number, min: number, max: number) =>
  val > max ? max : val < min ? min : val;
