import { singleton } from 'tsyringe';
import { parse } from 'yaml';
import { readFileSync } from 'fs';
import { objectMap } from '../utils/object.util';
import { logger } from '../logger';

export interface ConfigData {
  slider_mapping: Record<string, string[]>;
  invert_slider: boolean;
  com_port: string;
  baud_rate: number;
  noise_reduction: string;
}

@singleton()
export class ConfigService {
  private configData: ConfigData;

  constructor() {
    logger.info('config-service init');

    const configFile = readFileSync('./config.yaml', 'utf8');
    const configData = parse(configFile);

    const slider_mapping = objectMap(
      configData.slider_mapping,
      (k: string) => k,
      (v: string) => (typeof v === 'string' ? [v] : v),
    );

    this.configData = { ...configData, slider_mapping };
  }

  get config() {
    return this.configData;
  }
}
