import { hideConsole } from 'node-hide-console-window';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { logger } from './logger/logger';
import { ConfigService } from './services/config.service';
import { SerialService } from './services/serial.service';
import { SessionsService } from './services/sessions.service';
import { SliderService } from './services/slider.service';
import { systray } from './systray/systray';
import onExit from 'signal-exit';

hideConsole();

systray
  .ready()
  .then(() => {
    logger.info('INIT | Systray');
  })
  .catch((err) => {
    logger.warn(`Systray failed to start: ${err.message}`);
  });

container.resolve(ConfigService);
container.resolve(SerialService);
container.resolve(SliderService);
container.resolve(SessionsService);

logger.info('INIT | DeejJS');

onExit(() => {
  logger.info('EXIT | DeejJS');
});
