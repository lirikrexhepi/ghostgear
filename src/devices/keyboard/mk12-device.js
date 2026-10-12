import { BaseDevice } from '../base-device.js';
import { MK12Protocol, LIGHT_EFFECTS } from './mk12-protocol.js';
import { MK12_LAYOUT } from './mk12-layout.js';
import { eventBus } from '../../core/event-bus.js';

const LED_WRITE_DELAY_MS = 45;

export class MeetionMK12Device extends BaseDevice {
  constructor(options = {}) {
    super({
      ...options,
      name: 'Meetion MK12',
      displayName: 'Meetion MK12',
      type: 'keyboard',
      vendorId: 0x3151,
      productId: 0x4015,
      connectionMode: 'wired',
      battery: 100
    });

    this.connectionType = 'USB-C';
    this.layout = MK12_LAYOUT;
    this.lightEffects = LIGHT_EFFECTS;
    this.lightState = {
      effectIndex: 4,
      effectId: 'LightWave',
      speed: 4,
      bright: 4,
      dazzle: true,
      rgb: 0x00ffcc
    };
    this.debounceMs = 10;
    this.sleepTimers = { timeBT: 180, time24: 180, deepBT: 720, deep24: 720 };
    this.keyRemaps = new Map();
    this.ledTimer = null;
    this.ledWaiters = [];
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
      console.warn('Could not read settings from MK12:', e);
    }
    eventBus.emit('device:status', { id: this.id, isOnline: true });
    return true;
  }

  async fetchCurrentSettings() {
    if (this.isMock) return;
    const led = MK12Protocol.parseLedPacket(await this.request(MK12Protocol.buildGetPacket(MK12Protocol.CMD_GET_LEDPARAM)));
    if (led) this.lightState = { ...this.lightState, ...led };
    const debounce = MK12Protocol.parseDebouncePacket(await this.request(MK12Protocol.buildGetPacket(MK12Protocol.CMD_GET_DEBOUNCE)));
    if (debounce) this.debounceMs = debounce;
    const sleep = MK12Protocol.parseSleepPacket(await this.request(MK12Protocol.buildGetPacket(MK12Protocol.CMD_GET_SLEEPTIME)));
    if (sleep) this.sleepTimers = sleep;
    eventBus.emit('device:lighting_updated', this.lightState);
  }

  setLighting(patch) {
    this.lightState = { ...this.lightState, ...patch };
    const effect = LIGHT_EFFECTS.find(e => e.index === this.lightState.effectIndex);
    if (effect) this.lightState.effectId = effect.id;
    eventBus.emit('device:lighting_updated', this.lightState);
    return new Promise(resolve => {
      this.ledWaiters.push(resolve);
      clearTimeout(this.ledTimer);
      this.ledTimer = setTimeout(() => {
        const waiters = this.ledWaiters;
        this.ledWaiters = [];
        this.write(MK12Protocol.buildSetLedPacket(this.lightState))
          .then(() => waiters.forEach(w => w(true)))
          .catch(() => waiters.forEach(w => w(false)));
      }, LED_WRITE_DELAY_MS);
    });
  }

  async setDebounce(ms) {
    this.debounceMs = ms;
    eventBus.emit('device:debounce_updated', ms);
    await this.write(MK12Protocol.buildSetDebouncePacket(ms));
    return true;
  }

  async setSleep(timers) {
    this.sleepTimers = { ...this.sleepTimers, ...timers };
    eventBus.emit('device:sleep_updated', this.sleepTimers);
    await this.write(MK12Protocol.buildSetSleepPacket(this.sleepTimers));
    return true;
  }

  async remapKey(keyId, newCode) {
    this.keyRemaps.set(keyId, newCode);
    eventBus.emit('device:keymap_updated', { keyId, newCode });
    return true;
  }

  clearKeyRemap(keyId) {
    if (!this.keyRemaps.delete(keyId)) return;
    eventBus.emit('device:keymap_updated', { keyId, reset: true });
  }

  resetKeyRemaps() {
    this.keyRemaps.clear();
    eventBus.emit('device:keymap_updated', { reset: true });
  }
}
