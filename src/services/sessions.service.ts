import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer';
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  map,
  merge,
  pluck,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { singleton } from 'tsyringe';
import { logger } from '../logger';
import { ConfigService } from './config.service';
import { SliderService } from './slider.service';

interface ISession {
  pid: number;
  name: string;
}

export interface ISessionsState {
  isFresh: boolean;
  isStale: boolean;
  sessions: ISession[];
}

const MIN_THRESHOLD_TIME = 5 * 1000;
const MAX_THRESHOLD_TIME = 45 * 1000;

const CUSTOM_SESSIONS = ['master'];

@singleton()
export class SessionsService {
  private stateSubject = new BehaviorSubject<ISessionsState>({
    isFresh: false,
    isStale: true,
    sessions: [],
  });

  state$ = this.stateSubject.asObservable();
  sessions$ = this.stateSubject.asObservable().pipe(pluck('sessions'));

  constructor(
    private configService: ConfigService,
    private sliderService: SliderService,
  ) {
    logger.info('sessions-service init');

    const freshTimer$ = timer(MIN_THRESHOLD_TIME);
    const staleTimer$ = timer(MAX_THRESHOLD_TIME);

    const isStale$ = this.stateSubject.asObservable().pipe(pluck('isStale'));
    const isFresh$ = this.stateSubject.asObservable().pipe(pluck('isFresh'));

    const isStaleChanged$ = isStale$.pipe(distinctUntilChanged());
    const isFreshChanged$ = isFresh$.pipe(distinctUntilChanged());

    const updateIsStale$ = isStaleChanged$.pipe(
      map((val) => !val),
      filter(Boolean),
      switchMap(() => staleTimer$),
      tap(() =>
        this.stateSubject.next({ ...this.stateSubject.value, isStale: true }),
      ),
    );

    const updateIsFresh$ = isFreshChanged$.pipe(
      filter(Boolean),
      switchMap(() => freshTimer$),
      tap(() =>
        this.stateSubject.next({ ...this.stateSubject.value, isFresh: false }),
      ),
    );

    const updateSessions$ = this.sliderService.sliderChangeEvent$.pipe(
      tap((ev) => {
        logger.debug('slider-change-event: %o', ev);
      }),
      tap((ev) => {
        const state = this.stateSubject.value;
        const targetSessions = this.getTargetSessions(ev.slider);

        if (state.isStale) {
          this.refreshSessions('staled out');
          return;
        }

        if (
          !targetSessions
            .filter((sessionName) => !CUSTOM_SESSIONS.includes(sessionName))
            .every((sessionName) =>
              state.sessions.map((s) => s.name).includes(sessionName),
            ) &&
          !state.isFresh
        ) {
          this.refreshSessions('target session not found');
        }
      }),
      tap((ev) => {
        const state = this.stateSubject.value;
        const targetSessions = this.getTargetSessions(ev.slider);

        targetSessions.forEach((sessionName) =>
          this.setSessionVolume(sessionName, state.sessions, ev.value),
        );
      }),
    );

    merge(updateIsStale$, updateIsFresh$, updateSessions$).subscribe();
  }

  refreshSessions(reason: string) {
    logger.debug(`session-refreshed: ${reason ? reason : ''}`);
    const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses();
    this.stateSubject.next({ isFresh: true, isStale: false, sessions });
  }

  getTargetSessions(sliderKey: number) {
    return this.configService.config.slider_mapping[sliderKey] ?? [];
  }

  setSessionVolume(
    targetSessionName: string,
    sessions: ISession[],
    volumeLevel: number,
  ) {
    if (targetSessionName === 'master') {
      NodeAudioVolumeMixer.setMasterVolumeLevelScalar(volumeLevel);
    } else {
      const session = sessions.find(
        (session) => session.name === targetSessionName,
      );
      if (session) {
        NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(
          session.pid,
          volumeLevel,
        );
      }
    }
  }
}
