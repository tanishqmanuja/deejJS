import {
  BehaviorSubject,
  bufferCount,
  filter,
  map,
  merge,
  mergeMap,
  share,
  tap,
  throttleTime,
} from 'rxjs';
import { zip } from 'simzip';
import { singleton } from 'tsyringe';
import { logger } from '../logger/logger';
import { arrayAvg } from '../utils/array.util';
import { clamp, roundFloat } from '../utils/math.util';
import { selectDistinctState } from '../utils/rxjs.util';
import { ConfigService, NOISE_REDUCTION_LEVELS_MAP } from './config.service';
import { SerialService } from './serial.service';

export interface SliderChangeEvent {
  slider: number;
  value: number;
}

@singleton()
export class SliderService {
  private state: Record<number, number> = {};
  private thresholdSubject = new BehaviorSubject<number>(
    NOISE_REDUCTION_LEVELS_MAP.default,
  );
  private invertSlidersSubject = new BehaviorSubject<boolean>(false);
  private dacBitsSubject = new BehaviorSubject<number>(10);

  private updateThreshold$ = this.configService.config$.pipe(
    selectDistinctState('noiseReduction'),
    map((level) => NOISE_REDUCTION_LEVELS_MAP[level]),
    tap((threshold) => this.thresholdSubject.next(threshold)),
  );

  private updateInvertSliders$ = this.configService.config$.pipe(
    selectDistinctState('invertSliders'),
    tap((invertSliders) => this.invertSlidersSubject.next(invertSliders)),
  );

  private updateDacBits$ = this.configService.config$.pipe(
    selectDistinctState('dacBits'),
    filter(Boolean),
    tap((dacBits) => this.dacBitsSubject.next(dacBits)),
  );

  private filteredLineData$ = this.serialService.lineData$.pipe(
    throttleTime(10),
    filter(isValidLine),
    map(splitBy('|')),
    map(normalize(this.dacBitsSubject.value)),
    map(invertIfRequired(this.invertSlidersSubject.value)),
    bufferCount(10, 1),
    map(calcBufferAverage),
    map(roundTo(2)),
  );

  sliderChangeEvent$ = this.filteredLineData$.pipe(
    map((data) =>
      significantValueChanges(
        Object.values(this.state),
        data,
        this.thresholdSubject.value,
      ),
    ),
    filter((events) => events.length > 0),
    mergeMap((event) => event),
    tap((event) => (this.state[event.slider] = event.value)),
    share(),
  );

  constructor(
    private configService: ConfigService,
    private serialService: SerialService,
  ) {
    logger.info('INIT | SliderService');

    merge(
      this.updateThreshold$,
      this.updateInvertSliders$,
      this.updateDacBits$,
      this.sliderChangeEvent$,
    ).subscribe();
  }
}

const EXPECTED_LINE_PATTERN = RegExp(/^\d{1,4}(\|\d{1,4})*$/);

const isValidLine = (str: string) => EXPECTED_LINE_PATTERN.test(str);

const splitBy = (separator: string | RegExp) => (line: string) =>
  line.split(separator);

const normalize = (dacBits: number) => (data: string[]) =>
  data
    .map((str) => parseInt(str, 10) / 2 ** dacBits)
    .map((val) => clamp(val, 0, 1));

const invertIfRequired = (invert: boolean) => (data: number[]) =>
  data.map((val) => (invert ? 1 - val : val));

const calcBufferAverage = (data: number[][]) =>
  zip(data, { truncate: false, placeholder: 0 }).map(arrayAvg);

const roundTo = (decimal: number) => (data: number[]) =>
  data.map((d) => roundFloat(d, decimal));

const significantValueChanges = (
  pre: number[],
  curr: number[],
  threshold: number,
) =>
  curr
    .map((_, i) =>
      isSignificantlyDifferent(pre[i] || 0, curr[i] || 0, threshold)
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
