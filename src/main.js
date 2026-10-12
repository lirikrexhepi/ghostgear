import { state } from './core/state.js';
import { hidManager } from './core/hid-manager.js';
import { eventBus } from './core/event-bus.js';
import { AppShell } from './ui/app-shell.js';
import { HomeView } from './ui/views/home-view.js';
import { DeviceView } from './ui/views/device-view.js';
import { prewarmDevice3D } from './ui/components/device-3d.js';

class App {
  constructor() {
    this.appRoot = document.getElementById('app');
    this.view = null;
    this.viewName = null;
  }

  init() {
    state.setTheme(state.theme);
    new AppShell(this.appRoot);
    eventBus.on('view:changed', viewName => this.renderView(viewName));
    eventBus.on('device:added', () => {
      if (this.viewName === 'device' && this.view && this.view.device !== state.activeDevice) {
        this.renderView('device');
      }
    });
    hidManager.init();
    this.renderView(state.currentView);
    const warm = () => prewarmDevice3D().catch(() => {});
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 1200 });
    else setTimeout(warm, 300);
  }

  renderView(viewName) {
    const main = document.getElementById('app-main-content');
    if (!main) return;
    if (this.view && this.view.destroy) this.view.destroy();
    main.innerHTML = '';
    if (viewName === 'device' && state.activeDevice) {
      this.viewName = 'device';
      this.view = new DeviceView(main, state.activeDevice);
    } else {
      this.viewName = 'home';
      this.view = new HomeView(main);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App().init();
});
