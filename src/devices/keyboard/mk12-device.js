import { BaseDevice } from '../base-device.js';
import { MK12Protocol, LIGHT_EFFECTS } from './mk12-protocol.js';
import { MK12_LAYOUT, MK12_LED_INDEX } from './mk12-layout.js';
import { eventBus } from '../../core/event-bus.js';

const LED_WRITE_DELAY_MS = 45;
const PERKEY_PACKET_GAP_MS = 100;
const KEYMAP_PERSIST_DELAY_MS = 600;
const KEYMAP_PERSIST_MIN_GAP_MS = 4000;
const KEYMAP_VERIFY_TRIES = 6;
const KEYMAP_VERIFY_GAP_MS = 70;
const KEYMAP_READ_GAP_MS = 20;

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
    this.supports = { keymap: false, perKey: true };
    this.keymap = null;
    this.keymapTimer = null;
    this.pendingKeys = new Map();
    this.lastPersistEnd = 0;
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
    await this.readKeymap();
  }

  async readKeymap(layer = 0) {
    if (this.isMock) return null;
    const entries = [];
    try {
      for (let page = 0; page < MK12Protocol.KEYMAP_PAGES; page += 1) {
        const bytes = await this.request(MK12Protocol.buildGetKeymapPacket(layer, page));
        const chunk = MK12Protocol.parseKeymapPage(bytes);
        if (!chunk) return null;
        entries.push(...chunk);
      }
    } catch (e) {
      console.warn('Could not read the keymap from MK12:', e);
      return null;
    }
    this.keymap = entries;
    this.keyRemaps.clear();
    this.layout.keys.forEach(key => {
      const index = MK12_LED_INDEX[key.id];
      const entry = index != null ? entries[index] : null;
      if (!entry || key.id === 'Fn' || key.id === 'LED_Mode') return;
      const code = MK12Protocol.codeForEntry(entry);
      if (code != null && code !== key.code) this.keyRemaps.set(key.id, code);
    });
    eventBus.emit('device:keymap_updated', { loaded: true });
    return entries;
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

  async writePerKey(colorsByKeyId) {
    const colors = new Map();
    colorsByKeyId.forEach((rgb, keyId) => {
      const led = MK12_LED_INDEX[keyId];
      if (led != null) colors.set(led, rgb);
    });
    if (this.isMock) {
      eventBus.emit('device:perkey_updated', colorsByKeyId);
      return true;
    }
    if (this.lightState.effectIndex !== MK12Protocol.EFFECT_CUSTOM) {
      await this.setLighting({ effectIndex: MK12Protocol.EFFECT_CUSTOM });
    }
    await this.settleFlash();
    const packets = MK12Protocol.buildPerKeyPackets(colors);
    for (let i = 0; i < packets.length; i += 1) {
      await this.write(packets[i]);
      if (i < packets.length - 1) await this.sleep(PERKEY_PACKET_GAP_MS);
    }
    this.lastPersistEnd = Date.now();
    eventBus.emit('device:perkey_updated', colorsByKeyId);
    return true;
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
    await this.applyKey(keyId, newCode);
    return true;
  }

  async clearKeyRemap(keyId) {
    if (!this.keyRemaps.delete(keyId)) return;
    eventBus.emit('device:keymap_updated', { keyId, reset: true });
    const key = this.layout.keys.find(k => k.id === keyId);
    if (key) await this.applyKey(keyId, key.code);
  }

  async resetKeyRemaps() {
    const ids = Array.from(this.keyRemaps.keys());
    this.keyRemaps.clear();
    eventBus.emit('device:keymap_updated', { reset: true });
    for (const id of ids) {
      const key = this.layout.keys.find(k => k.id === id);
      if (key) await this.applyKey(id, key.code);
    }
  }

  async applyKey(keyId, code) {
    const index = MK12_LED_INDEX[keyId];
    if (this.isMock || !this.supports.keymap || index == null || keyId === 'Fn') return;
    await this.settleFlash();
    const entry = MK12Protocol.entryForCode(code);
    try {
      await this.write(MK12Protocol.buildSetKeyPacket(0, index, entry));
    } catch (e) {
      return;
    }
    this.pendingKeys.set(index, entry);
    if (this.keymap) this.keymap[index] = entry;
    await this.verifyKey(index, entry);
    clearTimeout(this.keymapTimer);
    this.keymapTimer = setTimeout(() => this.persistKeymap(), KEYMAP_PERSIST_DELAY_MS);
  }

  async settleFlash() {
    const gap = this.lastPersistEnd + KEYMAP_PERSIST_MIN_GAP_MS - Date.now();
    if (gap > 0) await this.sleep(gap);
  }

  readPage(layer, page, delay = 120) {
    return this.enqueue(async () => {
      await this.sendFeatureReport(0, MK12Protocol.buildGetKeymapPacket(layer, page));
      await this.sleep(delay);
      const view = await this.receiveFeatureReport(0);
      return MK12Protocol.parseKeymapPage(view);
    });
  }

  async verifyKey(index, entry) {
    for (let i = 0; i < KEYMAP_VERIFY_TRIES; i += 1) {
      try {
        const page = await this.readPage(0, index >> 4, KEYMAP_VERIFY_GAP_MS);
        const seen = page && page[index & 15];
        if (seen && seen.every((v, k) => v === entry[k])) return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async persistKeymap() {
    if (this.isMock || !this.pendingKeys.size) return;
    await this.settleFlash();
    const pending = new Map(this.pendingKeys);
    this.pendingKeys.clear();
    try {
      const fresh = [];
      for (let page = 0; page < MK12Protocol.KEYMAP_PAGES; page += 1) {
        const chunk = await this.readPage(0, page, 60);
        if (!chunk) throw new Error('keymap read failed');
        fresh.push(...chunk);
        await this.sleep(KEYMAP_READ_GAP_MS);
      }
      pending.forEach((entry, index) => {
        fresh[index] = entry;
      });
      this.keymap = fresh;
      const packets = MK12Protocol.buildSetKeymapPackets(0, fresh);
      await this.enqueue(async () => {
        for (let i = 0; i < packets.length; i += 1) {
          await this.sendFeatureReport(0, packets[i]);
          if (i < packets.length - 1) await this.sleep(PERKEY_PACKET_GAP_MS);
        }
      });
    } catch (e) {
      pending.forEach((entry, index) => this.pendingKeys.set(index, entry));
    }
    this.lastPersistEnd = Date.now();
  }
}
