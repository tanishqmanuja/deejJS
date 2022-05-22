import SoundMixer, { Device, DeviceType } from 'native-sound-mixer';
import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer';
import {
  BehaviorSubject,
  filter,
  map,
  merge,
  pluck,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { singleton } from 'tsyringe';
import { logger } from '../logger/logger';
import { enforceArray } from '../utils/array.util';
import { objectMap } from '../utils/object.util';
import { selectDistinctState } from '../utils/rxjs.util';
import { ConfigService } from './config.service';
import { SliderChangeEvent, SliderService } from './slider.service';
interface Session {
  pid: number;
  name: string;
}

export interface SessionsState {
  isFresh: boolean;
  isStale: boolean;
  sessions: Session[];
}

const MIN_REFRESH_TIME = 5 * 1000;
const MAX_REFRESH_TIME = 45 * 1000;

const CUSTOM_SESSIONS = ['master', 'system', 'mic'];

@singleton()
export class SessionsService {
  private stateSubject = new BehaviorSubject<SessionsState>({
    isFresh: true,
    isStale: false,
    sessions: NodeAudioVolumeMixer.getAudioSessionProcesses() || [],
  });

  state$ = this.stateSubject.asObservable();
  sessions$ = this.stateSubject.asObservable().pipe(pluck('sessions'));

  private freshTimer$ = timer(MIN_REFRESH_TIME);
  private staleTimer$ = timer(MAX_REFRESH_TIME);

  private isStaleChanged$ = this.state$.pipe(selectDistinctState('isStale'));
  private isFreshChanged$ = this.state$.pipe(selectDistinctState('isFresh'));

  private updateIsStale$ = this.isStaleChanged$.pipe(
    map((val) => !val),
    filter(Boolean),
    switchMap(() => this.staleTimer$),
    tap(() =>
      this.stateSubject.next({ ...this.stateSubject.value, isStale: true }),
    ),
  );

  private updateIsFresh$ = this.isFreshChanged$.pipe(
    filter(Boolean),
    switchMap(() => this.freshTimer$),
    tap(() =>
      this.stateSubject.next({ ...this.stateSubject.value, isFresh: false }),
    ),
  );

  private updateSessions$ = this.sliderService.sliderChangeEvent$.pipe(
    tap((ev) => {
      logger.debug('Slider change detected: %o', ev);
    }),
    tap((ev) => this.handleRefreshOnSliderChange(ev)),
    tap((ev) => this.handleSessionVolumeOnSliderChange(ev)),
  );

  constructor(
    private configService: ConfigService,
    private sliderService: SliderService,
  ) {
    logger.info('INIT | SessionsService');

    merge(
      this.updateIsStale$,
      this.updateIsFresh$,
      this.updateSessions$,
    ).subscribe();
  }

  handleRefreshOnSliderChange(ev: SliderChangeEvent) {
    const state = this.stateSubject.value;
    const targetSessions = this.getTargetSessions(ev.slider);

    if (state.isStale) {
      this.refreshSessions('staled out');
      return;
    }

    if (
      !targetSessions
        .filter((sessionName: string) => !CUSTOM_SESSIONS.includes(sessionName))
        .every((sessionName: string) =>
          state.sessions.map((s) => s.name).includes(sessionName),
        ) &&
      !state.isFresh
    ) {
      this.refreshSessions('target session not found');
    }
  }

  handleSessionVolumeOnSliderChange(ev: SliderChangeEvent) {
    const state = this.stateSubject.value;
    const targetSessions = this.getTargetSessions(ev.slider);

    targetSessions.forEach((sessionName: string) =>
      this.setSessionVolume(sessionName, state.sessions, ev.value),
    );
  }

  refreshSessions(reason: string) {
    logger.debug(`Session refreshed: ${reason ? reason : ''}`);
    const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses();
    this.stateSubject.next({ isFresh: true, isStale: false, sessions });
  }

  getTargetSessions(sliderKey: number) {
    const config = this.configService.config;
    const sliderMapping = objectMap(
      config.sliderMapping,
      (k: string) => k,
      (v: string | string[]) => enforceArray(v),
    );

    return sliderMapping[sliderKey] ?? [];
  }

  setSessionVolume(
    targetSessionName: string,
    sessions: Session[],
    volumeLevel: number,
  ) {
    if (targetSessionName === 'master') {
      NodeAudioVolumeMixer.setMasterVolumeLevelScalar(volumeLevel);
    } else if (targetSessionName === 'system') {
      NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(0, volumeLevel);
    } else if (targetSessionName === 'mic') {
      const mic: Device | undefined = SoundMixer.getDefaultDevice(
        DeviceType.CAPTURE,
      );
      if (mic) {
        mic.volume = volumeLevel;
      }
    } else if (!(targetSessionName.substring(-4) === '.exe')) {
      const devices: Device[] = SoundMixer.devices;
      const device = devices.find((d) => d.name === targetSessionName);
      if (device) {
        device.volume = volumeLevel;
      }
    } else {
      const session = sessions.find(
        (session) =>
          session.name.toLowerCase() === targetSessionName.toLowerCase(),
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
