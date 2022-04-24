import { zip } from 'simzip';
import { container } from 'tsyringe';
import { ConfigService } from '../services/config.service';
import { clamp, roundFloat } from './math.util';

const { config } = container.resolve(ConfigService);

const noiseReductionMap = {
  low: 0.015,
  default: 0.025,
  high: 0.035,
};

export const processData = (data: string) =>
  data
    .split('|')
    .map((data) => parseInt(data, 10) / 1024)
    .map((data) => clamp(data, 0, 1))
    .map((data) => (config.invert_slider ? 1 - data : data));

export const calcBufferAverage = (data: number[][]) => {
  const avg = (arr: number[]) =>
    arr.reduce((acc, val) => acc + val, 0) / arr.length;

  return zip(data, { truncate: false, placeholder: 0 }).map(avg);
};

export const roundTo = (decimal: number) => (data: number[]) =>
  data.map((d) => roundFloat(d, decimal));

export const significantValueChanges = (pre: number[], curr: number[]) =>
  curr
    .map((_, i) =>
      isSignificantlyDifferent(
        pre[i] || 0,
        curr[i] || 0,
        noiseReductionMap[config.noise_reduction] || noiseReductionMap.default,
      )
        ? { slider: i, value: curr[i] }
        : null,
    )
    .filter(Boolean);

const isSignificantlyDifferent = (
  pre: number,
  curr: number,
  threshold: number,
) => {
  if (Math.abs(pre - curr) >= threshold) {
    return true;
  }
  if (
    (almostEquals(curr, 1.0) && pre != 1.0) ||
    (almostEquals(curr, 0.0) && pre != 0.0)
  ) {
    return true;
  }
  return false;
};

const almostEquals = (pre: number, curr: number) =>
  Math.abs(pre - curr) < 0.000001;
