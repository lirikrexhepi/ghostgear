import { BaseDevice } from '../base-device.js';
import { eventBus } from '../../core/event-bus.js';

export class Cloud3Device extends BaseDevice {
  constructor(options = {}) {
    super({
      ...options,
      name: 'HyperX Cloud III',
      displayName: 'HyperX Cloud III',
      type: 'headset',
      vendorId: 0x03F0,
      productId: 0x089D,
      connectionMode: 'wired',
      battery: 100
    });

    this.connectionType = 'USB';
    this.sidetone = false;
  }

  async connect() {
    if (this.isMock) {
      this.isOnline = true;
      eventBus.emit('device:status', { id: this.id, isOnline: true });
      return true;
    }
    if (!this.hidDevice.opened) await this.hidDevice.open();
    this.isOnline = true;
    try {
      await this.fetchCurrentSettings();
    } catch (e) {
      console.warn('Could not read settings from Cloud III:', e);
    }
    eventBus.emit('device:status', { id: this.id, isOnline: true });
    return true;
  }

  async fetchCurrentSettings() {
    if (this.isMock) return;
    try {
      const res = await this.receiveFeatureReport(0x20);
      if (res && res.length >= 2) {
        const val = res[0] === 0x86 ? res[1] : (res[1] === 0x86 ? res[2] : 0);
        this.sidetone = val === 1;
        eventBus.emit('device:sidetone_updated', this.sidetone);
      }
    } catch (e) {
      console.warn('Could not fetch sidetone report:', e);
    }
  }

  async setSidetone(enabled) {
    this.sidetone = !!enabled;
    eventBus.emit('device:sidetone_updated', this.sidetone);
    if (this.isMock) return true;
    const packet = new Uint8Array(61);
    packet[0] = 0x86;
    packet[1] = this.sidetone ? 1 : 0;
    await this.enqueue(() => this.sendFeatureReport(0x20, packet));
    return true;
  }
}
