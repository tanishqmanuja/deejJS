import SysTray, { MenuItem } from 'systray2';
import { platform } from 'os';
import { iconDarwinLinux, iconWin } from './icons';
import { showConsole, hideConsole } from 'node-hide-console-window';
import { container } from 'tsyringe';
import { SerialService } from '../services/serial.service';

const serialService = container.resolve(SerialService);

export type MenuItemWithClick = MenuItem & {
  click: () => void;
};

const enableConsoleMenuItem = {
  title: 'Enable Console',
  tooltip: 'enable console',
  checked: false,
  enabled: true,
  click: () => {
    enableConsoleMenuItem.checked = !enableConsoleMenuItem.checked;

    if (enableConsoleMenuItem.checked) {
      showConsole();
    } else {
      hideConsole();
    }

    systray.sendAction({
      type: 'update-item',
      item: enableConsoleMenuItem,
    });
  },
};

const rescanPortMenuItem = {
  title: 'Rescan Port',
  tooltip: 'rescan port',
  checked: false,
  enabled: true,
  click: () => {
    serialService.rescanPort();
  },
};

const exitMenuItem = {
  title: 'Exit',
  tooltip: 'exit',
  checked: false,
  enabled: true,
  click: () => {
    systray.kill(false);
    process.exit();
  },
};

export const systray = new SysTray({
  menu: {
    icon: platform() === 'win32' ? iconWin : iconDarwinLinux,
    isTemplateIcon: platform() === 'darwin',
    title: 'Deej',
    tooltip: 'Deej',
    items: [
      rescanPortMenuItem,
      enableConsoleMenuItem,
      SysTray.separator,
      exitMenuItem,
    ],
  },
  debug: false,
  copyDir: true,
});

systray.onClick((action) => {
  if (action.item != null) {
    const item = action.item as MenuItemWithClick;
    item.click?.();
  }
});
