import { bufferCount, fromEvent, map, share, throttleTime } from 'rxjs';
import { ReadlineParser, SerialPort } from 'serialport';
import { singleton } from 'tsyringe';
import { logger } from '../logger';
import { processData, calcBufferAverage, roundTo } from '../utils/data.util';
import { ConfigService } from './config.service';

@singleton()
export class SerialService {
  private port: SerialPort;

  constructor(private configService: ConfigService) {
    logger.info('serial-service init');

    this.port = new SerialPort({
      path: this.configService.config.com_port,
      baudRate: this.configService.config.baud_rate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    });

    this.openPort();
  }

  get filteredLineData$() {
    const lineStream = this.port.pipe(
      new ReadlineParser({ delimiter: '\r\n' }),
    );
    const lineData$ = fromEvent(lineStream, 'data');
    return lineData$.pipe(
      throttleTime(10),
      map(processData),
      bufferCount(10, 1),
      map(calcBufferAverage),
      map(roundTo(2)),
      share(),
    );
  }

  openPort() {
    logger.debug('opening serial port');
    this.port.open();
  }

  closePort() {
    logger.debug('closing serial port');
    this.port.close();
  }
}
