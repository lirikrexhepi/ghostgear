import { eventBus } from '../core/event-bus.js';

export class BaseDevice {
  constructor(options = {}) {
    this.id = options.id || `dev_${Date.now()}`;
    this.name = options.name || 'Generic Device';
    this.displayName = options.displayName || this.name;
    this.type = options.type || 'keyboard';
    this.vendorId = options.vendorId || 0;
    this.productId = options.productId || 0;
    this.hidDevice = options.hidDevice || null;
    this.isOnline = options.isOnline ?? true;
    this.connectionMode = options.connectionMode || 'wireless';
    this.battery = options.battery ?? 85;
    this.profileIndex = 0;
    this.isMock = options.isMock ?? false;
    this.ioQueue = Promise.resolve();
    this.lastError = null;
  }

  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  async disconnect() {
    if (this.hidDevice && this.hidDevice.opened) {
      await this.hidDevice.close();
    }
    this.isOnline = false;
    eventBus.emit('device:status', { id: this.id, isOnline: false });
  }

  enqueue(task) {
    const run = this.ioQueue.then(task, task);
    this.ioQueue = run.catch(err => {
      this.lastError = err;
      console.warn(`[${this.name}] HID error:`, err);
      eventBus.emit('device:error', { id: this.id, error: err });
    });
    return run;
  }

  async sendFeatureReport(reportId, data) {
    if (this.isMock) return true;
    if (!this.hidDevice || !this.hidDevice.opened) {
      throw new Error('Device is not open');
    }
    let buffer = data;
    if (reportId === 0 && buffer.length < 64) {
      buffer = new Uint8Array(64);
      buffer.set(data.subarray ? data.subarray(0, 64) : data.slice(0, 64));
    }
    await this.hidDevice.sendFeatureReport(reportId, buffer);
    return true;
  }

  async receiveFeatureReport(reportId) {
    if (this.isMock) return null;
    if (!this.hidDevice || !this.hidDevice.opened) {
      throw new Error('Device is not open');
    }
    const view = await this.hidDevice.receiveFeatureReport(reportId);
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  write(packet) {
    return this.enqueue(() => this.sendFeatureReport(0, packet));
  }

  request(packet, delayMs = 150) {
    return this.enqueue(async () => {
      await this.sendFeatureReport(0, packet);
      if (this.isMock) return null;
      await this.sleep(delayMs);
      return this.receiveFeatureReport(0);
    });
  }

  onInputReport(callback) {
    if (this.hidDevice) {
      this.hidDevice.addEventListener('inputreport', (event) => {
        const v = event.data;
        callback(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), event.reportId);
      });
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
