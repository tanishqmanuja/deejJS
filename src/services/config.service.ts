import { watch } from 'fs';
import {
  BehaviorSubject,
  debounceTime,
  fromEvent,
  merge,
  Subject,
  tap,
} from 'rxjs';
import { singleton } from 'tsyringe';
import { logger } from '../logger/logger';
import { readYAML } from '../utils/file.util';
import { objectMap } from '../utils/object.util';
import { snakeToCamel, toTitleCase } from '../utils/string.util';

const CONFIG_PATHS = {
  canonical: './config.yaml',
  experimental: './preferences.yaml',
};

const FILE_CHANGE_DEBOUNCE_TIME = 500;

export const NOISE_REDUCTION_LEVELS_MAP = {
  low: 0.015,
  default: 0.025,
  high: 0.035,
};

export type NoiseReductionLevel = keyof typeof NOISE_REDUCTION_LEVELS_MAP;

interface ICanonicalConfig {
  comPort: string;
  baudRate: number;
  sliderMapping: Record<string, string[] | string>;
  invertSliders: boolean;
  noiseReduction: NoiseReductionLevel;
}

interface IExperimentalConfig {
  dacBits: number;
  exitOnDisconnect: boolean;
  autoComPort: boolean;
  vendorId: string[] | string;
  manufacturer: string[] | string;
  [key: string]: unknown;
}

export type IConfig = Readonly<ICanonicalConfig & Partial<IExperimentalConfig>>;

@singleton()
export class ConfigService {
  private canonicalConfigSubject = new Subject<ICanonicalConfig>();
  private configSubject = new BehaviorSubject<IConfig>({
    ...this.readConfig('canonical'),
    ...this.readConfig('experimental'),
  });

  private canonicalConfigFileChanged$ = fromEvent(
    watch(CONFIG_PATHS.canonical),
    'change',
  ).pipe(
    debounceTime(FILE_CHANGE_DEBOUNCE_TIME),
    tap(() => this.canonicalConfigSubject.next(this.readConfig('canonical'))),
  );

  readonly config$ = this.configSubject.asObservable();
  readonly config = this.configSubject.value;

  constructor() {
    logger.info('INIT | ConfigService');

    merge(this.canonicalConfigFileChanged$).subscribe();
  }

  private readConfig(configType: keyof typeof CONFIG_PATHS) {
    const config = readYAML(CONFIG_PATHS[configType]);
    if (!config) {
      logger.verbose(`${toTitleCase(configType)} config not found`);
      if (configType === 'canonical') {
        logger.error('Cannot work without canonical config');
        return process.exit();
      }

      return undefined;
    }
    const mappedConfig = objectMap(
      config,
      (k: string) => snakeToCamel(k),
      (v) => v,
    );
    return mappedConfig;
  }
}
