import 'reflect-metadata';
import { container } from 'tsyringe';
import { logger } from './logger';
import { ConfigService } from './services/config.service';
import { SerialService } from './services/serial.service';
import { SessionsService } from './services/sessions.service';
import { SliderService } from './services/slider.service';

container.resolve(ConfigService);
const serialService = container.resolve(SerialService);
container.resolve(SliderService);
container.resolve(SessionsService);

logger.info('deejJS init');
logger.info('waiting for events...');

function exitHandler(options?: Record<string, unknown>) {
  if (options.closing) {
    serialService.closePort();
    logger.info('deejJS exit');
  }
  if (options.exit) {
    process.exit();
  }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { closing: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
