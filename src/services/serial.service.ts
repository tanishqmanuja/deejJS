import {
  BehaviorSubject,
  bindCallback,
  combineLatest,
  filter,
  from,
  map,
  merge,
  mergeMap,
  pluck,
  retry,
  skip,
  startWith,
  Subject,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { ReadlineParser, SerialPort } from 'serialport';
import { singleton } from 'tsyringe';
import { logger } from '../logger/logger';
import { enforceArray } from '../utils/array.util';
import { selectDistinctState } from '../utils/rxjs.util';
import { ConfigService } from './config.service';

export declare interface PortInfo {
  path: string;
  manufacturer: string | undefined;
  serialNumber: string | undefined;
  pnpId: string | undefined;
  locationId: string | undefined;
  productId: string | undefined;
  vendorId: string | undefined;
}
export interface SerialState {
  status: 'connected' | 'disconnected';
  serialPort: SerialPort | null;
}

const INITIAL_SERIAL_STATE: SerialState = {
  status: 'disconnected',
  serialPort: null,
};

const CONNECTION_TIMEOUT = 5000;

@singleton()
export class SerialService {
  private stateSubject = new BehaviorSubject<SerialState>(INITIAL_SERIAL_STATE);

  lineData$ = new Subject();

  private comPort$ = this.configService.config$.pipe(
    selectDistinctState('comPort'),
  );
  private baudRate$ = this.configService.config$.pipe(
    selectDistinctState('baudRate'),
  );

  private statusChangedToDisconnected$ = this.stateSubject.pipe(
    selectDistinctState('status'),
    filter((status) => status === 'disconnected'),
    skip(1),
  );

  private manualRescanPort$ = new Subject<boolean>();

  private updateSerialPort$ = combineLatest([
    this.comPort$,
    this.baudRate$,
    this.statusChangedToDisconnected$.pipe(startWith(null)),
    this.manualRescanPort$.pipe(startWith(null)),
  ]).pipe(
    switchMap(([comPort, baudRate]) =>
      from(this.tryConnection$(comPort, baudRate)),
    ),
    mergeMap((val) => val),
    tap({
      error: () => {
        if (this.configService.config.exitOnDisconnect) {
          process.exit();
        }
      },
    }),
    retry({
      resetOnSuccess: true,
      delay: (_err, retryCount) =>
        timer(Math.min(1000 * 60, 1000 * 2 ** retryCount)),
    }),
  );

  private updateSerialPortInfo$ = this.stateSubject.pipe(
    pluck('serialPort'),
    filter(Boolean),
    tap((port) => {
      const lineStream = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      lineStream.on('data', (data) => this.lineData$.next(data));
      lineStream.on('error', () =>
        this.stateSubject.next(INITIAL_SERIAL_STATE),
      );
      lineStream.on('end', () => console.log('end'));
      lineStream.on('close', () => console.log('close'));
    }),
  );

  private markAsDisconnected$ = this.lineData$.asObservable().pipe(
    switchMap(() => timer(CONNECTION_TIMEOUT)),
    tap(() => {
      logger.error(`Connection with device timed out`);
      this.stateSubject.next(INITIAL_SERIAL_STATE);
    }),
  );

  constructor(private configService: ConfigService) {
    logger.info('INIT | SerialService');

    merge(
      this.updateSerialPort$,
      this.updateSerialPortInfo$,
      this.markAsDisconnected$,
    ).subscribe();
  }

  rescanPort() {
    logger.debug('Rescanning port');
    this.manualRescanPort$.next(true);
  }

  private async tryConnection$(comPort: string, baudRate: number) {
    let portPath = comPort;

    logger.debug(
      `Attempting Connection for port ${comPort} at ${baudRate} baud`,
    );
    const prevSerialPort = this.stateSubject.value.serialPort;
    if (prevSerialPort?.isOpen) {
      prevSerialPort.close();
    }

    const list = await SerialPort.list();

    if (!list.find((port) => port.path === comPort)) {
      logger.error(`No device exists at port path ${comPort}`);

      if (this.configService.config.autoComPort) {
        logger.info('Attempting auto port detection');

        const manufacturers = enforceArray(
          this.configService.config.manufacturer,
        );
        const vendorIds = enforceArray(this.configService.config.vendorId);

        const port = list.find(
          (port) =>
            port.manufacturer &&
            (manufacturers.includes(port.manufacturer) ||
              vendorIds.includes(port.vendorId)),
        );

        if (port?.path) {
          portPath = port.path;
          logger.info(`Port detected at path ${portPath}`);
        }
      } else {
        return throwError(
          () => new Error(`No device exists at port path ${comPort}`),
        );
      }
    }

    const serialPort = new SerialPort({
      path: portPath,
      baudRate: baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    });
    return bindCallback(serialPort.open.bind(serialPort))().pipe(
      map((err) => {
        if (err) {
          const msg = (err as unknown as Error | null).message;
          logger.error(`Connection Failed with msg: ${msg}`);
          throw throwError(() => new Error(msg));
        }

        this.stateSubject.next({
          status: 'connected',
          serialPort,
        });

        logger.info(
          `Connection Successful for port ${portPath} at ${baudRate} baud`,
        );

        return [comPort, baudRate];
      }),
    );
  }
}
