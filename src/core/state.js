import { eventBus } from './event-bus.js';

class AppState {
  constructor() {
    this.devices = [];
    this.activeDevice = null;
    this.currentView = 'home'; // 'home' | 'device'
    this.activeTab = 'keymap'; // 'keymap' | 'lighting' | 'performance' | 'params' | 'config'
    this.theme = localStorage.getItem('gear_theme') || 'light';
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('gear_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    eventBus.emit('theme:changed', theme);
  }

  toggleTheme() {
    this.setTheme(this.theme === 'light' ? 'dark' : 'light');
  }

  addDevice(device) {
    if (!device) return;

    // If adding a real device, purge all mock devices
    if (!device.isMock) {
      this.devices = this.devices.filter(d => !d.isMock);
    }

    // Check for duplicate by ID or VID+PID (prevents multiple HID interfaces of composite device)
    const existingIndex = this.devices.findIndex(d => {
      if (d.id === device.id) return true;
      if (!device.isMock && !d.isMock && d.vendorId === device.vendorId && d.productId === device.productId) {
        return true;
      }
      if (device.isMock && d.isMock && d.type === device.type) {
        return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      if (this.devices[existingIndex].isMock && !device.isMock) {
        this.devices[existingIndex] = device;
        if (this.activeDevice?.isMock) {
          this.activeDevice = device;
        }
        eventBus.emit('device:added', device);
      }
      return;
    }

    this.devices.push(device);
    eventBus.emit('device:added', device);
  }

  removeDevice(deviceId) {
    this.devices = this.devices.filter(d => d.id !== deviceId);
    if (this.activeDevice?.id === deviceId) {
      this.activeDevice = null;
      this.currentView = 'home';
    }
    eventBus.emit('device:removed', deviceId);
    eventBus.emit('view:changed', this.currentView);
  }

  selectDevice(device) {
    this.activeDevice = device;
    this.currentView = 'device';
    eventBus.emit('device:selected', device);
    eventBus.emit('view:changed', 'device');
  }

  goHome() {
    this.currentView = 'home';
    eventBus.emit('view:changed', 'home');
  }

  setActiveTab(tab) {
    this.activeTab = tab;
    eventBus.emit('tab:changed', tab);
  }
}

export const state = new AppState();
