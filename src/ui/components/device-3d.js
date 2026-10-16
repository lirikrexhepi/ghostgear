import { eventBus } from '../../core/event-bus.js';
import { state } from '../../core/state.js';

let modulePromise = null;

function loadViewerModule() {
  if (!modulePromise) modulePromise = import('../../viewer3d/index.js');
  return modulePromise;
}

export function prewarmDevice3D(types = ['keyboard', 'mouse']) {
  return loadViewerModule().then(async ({ prewarmDeviceViewer }) => {
    for (const type of types) {
      await prewarmDeviceViewer(type, { theme: state.theme === 'dark' ? 'dark' : 'light' });
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  });
}

export function mountDevice3D(container, device, options = {}) {
  const type = device.type === 'mouse' ? 'mouse' : 'keyboard';
  let viewer = null;
  let destroyed = false;
  let offTheme = null;

  const ready = loadViewerModule().then(({ acquireDeviceViewer }) => {
    if (destroyed) return null;
    viewer = acquireDeviceViewer(container, {
      device: type,
      theme: state.theme === 'dark' ? 'dark' : 'light',
      autoRotate: !!options.autoRotate,
      describe: options.describe || null,
      partNames: options.partNames || null,
      onHover: options.onHover || null,
      onClick: options.onClick || null,
      onSelectionChange: options.onSelectionChange || null,
      onScroll: null,
      interactive: options.interactive !== false,
      insetRight: options.insetRight || 0,
      reserveRight: options.reserveRight != null ? options.reserveRight : null,
      enableLiveInput: !!options.enableLiveInput
    });
    offTheme = eventBus.on('theme:changed', theme => viewer && viewer.setTheme(theme === 'dark' ? 'dark' : 'light'));
    return viewer;
  });

  return {
    ready,
    get viewer() {
      return viewer;
    },
    destroy() {
      destroyed = true;
      if (offTheme) offTheme();
      if (viewer) {
        if (viewer.release) viewer.release();
        else viewer.dispose();
        viewer = null;
      }
    }
  };
}
