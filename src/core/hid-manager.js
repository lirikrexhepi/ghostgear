import { DeviceRegistry } from '../devices/registry.js';
import { state } from './state.js';
import { eventBus } from './event-bus.js';
import { toast } from '../ui/toast.js';

class HidManager {
  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'hid' in navigator;
    this.restored = !this.isSupported;
    this.restoring = null;
  }

  init() {
    if (!this.isSupported) {
      return;
    }

    // Auto-listen for disconnects
    navigator.hid.addEventListener('disconnect', (event) => {
      const hidDev = event.device;
      const target = state.devices.find(d => d.vendorId === hidDev.vendorId && d.productId === hidDev.productId);
      if (target) {
        state.removeDevice(target.id);
      }
    });

    navigator.hid.addEventListener('connect', () => {
      this.checkAuthorizedDevices();
    });

    this.checkAuthorizedDevices();
  }

  checkAuthorizedDevices() {
    if (!this.isSupported) return Promise.resolve();
    if (this.restoring) return this.restoring;
    this.restoring = this.restoreAuthorizedDevices().finally(() => {
      this.restoring = null;
      if (!this.restored) {
        this.restored = true;
        eventBus.emit('devices:restored');
      }
    });
    return this.restoring;
  }

  async restoreAuthorizedDevices() {
    try {
      const all = await navigator.hid.getDevices();
      const byId = new Map();
      const score = d => (d.collections || []).reduce((s, c) => s + ((c.featureReports || []).length ? 2 : 0) + (c.usagePage >= 0xff00 ? 1 : 0), 0);
      all.forEach(d => {
        const key = `${d.vendorId}:${d.productId}`;
        const prev = byId.get(key);
        if (!prev || score(d) > score(prev)) byId.set(key, d);
      });
      const known = d => state.devices.some(x => !x.isMock && x.vendorId === d.vendorId && x.productId === d.productId);
      const devices = Array.from(byId.values()).filter(d => !known(d));
      await Promise.all(devices.map(async hidDev => {
        try {
          const devInstance = DeviceRegistry.createFromHidDevice(hidDev);
          if (devInstance) {
            await devInstance.connect();
            state.addDevice(devInstance);
          }
        } catch (e) {
          console.warn('Could not reconnect a saved device:', e);
        }
      }));
    } catch (e) {
      console.error('Failed to get authorized HID devices:', e);
    }
  }

  async requestDevice() {
    if (!this.isSupported) {
      toast('Open Ghost Gear in Chrome or Edge to connect devices.');
      return null;
    }

    try {
      const filters = DeviceRegistry.getHidFilters();
      const selected = await navigator.hid.requestDevice({ filters });
      
      if (!selected || selected.length === 0) {
        return null;
      }

      const score = d => (d.collections || []).reduce((s, c) => s + ((c.featureReports || []).length ? 2 : 0) + (c.usagePage >= 0xff00 ? 1 : 0), 0);
      const hidDevice = selected.slice().sort((a, b) => score(b) - score(a))[0];
      const devInstance = DeviceRegistry.createFromHidDevice(hidDevice);

      if (!devInstance) {
        toast("This device isn't supported yet.");
        return null;
      }

      await devInstance.connect();
      state.addDevice(devInstance);
      state.selectDevice(devInstance);
      return devInstance;
    } catch (error) {
      if (error.name !== 'NotFoundError') {
        console.error('Error requesting HID device:', error);
        toast("Couldn't connect. Try unplugging it and plugging it back in.");
      }
      return null;
    }
  }

  async forgetDevice(device) {
    if (device.disconnect) {
      try {
        await device.disconnect();
      } catch (e) {
        console.warn('Disconnect failed:', e);
      }
    }
    if (device.hidDevice && device.hidDevice.forget) {
      try {
        await device.hidDevice.forget();
      } catch (e) {
        console.warn('Forget failed:', e);
      }
    }
    state.removeDevice(device.id);
  }

  // Add demo device for instant preview
  addDemoDevice(type = 'keyboard') {
    const demo = DeviceRegistry.createMockDevice(type);
    state.addDevice(demo);
    state.selectDevice(demo);
    return demo;
  }
}

export const hidManager = new HidManager();
