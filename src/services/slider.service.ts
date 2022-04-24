import { filter, map, mergeMap, tap } from 'rxjs';
import { singleton } from 'tsyringe';
import { logger } from '../logger';
import { significantValueChanges } from '../utils/data.util';
import { SerialService } from './serial.service';

export interface ISliderChangeEvent {
  slider: number;
  value: number;
}

@singleton()
export class SliderService {
  private state: Record<number, number> = {};

  constructor(private serialService: SerialService) {
    logger.info('slider-service init');
  }

  get sliderChangeEvent$() {
    return this.serialService.filteredLineData$.pipe(
      map((data) => significantValueChanges(Object.values(this.state), data)),
      filter((events) => events.length > 0),
      mergeMap((event) => event),
      tap((event) => (this.state[event.slider] = event.value)),
    );
  }
}
