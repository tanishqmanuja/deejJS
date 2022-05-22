import 'dotenv/config';
import SoundMixer from 'native-sound-mixer';
import { hideConsole } from 'node-hide-console-window';
import 'reflect-metadata';
import onExit from 'signal-exit';
import { container } from 'tsyringe';
import { logger } from './logger/logger';
import { ConfigService } from './services/config.service';
import { SerialService } from './services/serial.service';
import { SessionsService } from './services/sessions.service';
import { SliderService } from './services/slider.service';
import { systray } from './systray/systray';

systray
  .ready()
  .then(() => {
    logger.info('INIT | Systray');

    if (process.env.DEBUG) {
      systray.kill(false);
    } else {
      hideConsole();
    }
  })
  .catch((err) => {
    logger.warn(`Systray failed to start: ${err.message}`);
  });

container.resolve(ConfigService);
container.resolve(SerialService);
container.resolve(SliderService);
container.resolve(SessionsService);

logger.info('INIT | App');
console.log(
  'System devices:',
  SoundMixer.devices.map((d) => d.name),
);

onExit(() => {
  logger.info('EXIT | App');
});
