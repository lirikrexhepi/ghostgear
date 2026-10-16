import { BaseMouseDevice } from './mouse-base.js';
import { eventBus } from '../../core/event-bus.js';
import { VXE, buildFrame, check, rateFromCode, decodeDpi, encodeDpi, reverseLookup, encodeAction, decodeAction } from './vxe-protocol.js';

const COLORS = ['#FF453A', '#0A84FF', '#30D158', '#FFD60A', '#BF5AF2', '#FF9F0A', '#64D2FF', '#FF375F'];
const TOGGLE_ADDR = { movementSync: VXE.ADDR.motionSync, straightCorrection: VXE.ADDR.angleSnap, rippleCorrection: VXE.ADDR.ripple };

export class VXER1Device extends BaseMouseDevice {
  constructor(options = {}) {
    super({
      ...options,
      name: 'VXE R1 SE+',
      displayName: 'VXE R1 SE+',
      vendorId: 0x373b,
      productId: 0x1085,
      battery: 85
    });
    this.pending = null;
    this.supports = { sleep: true, longRange: true, sensorMode: true, dpiLight: true, buttons: true };
    this.firmware = null;
    this.pairing = null;
  }

  async connect() {
    if (this.isMock) {
      this.isOnline = true;
      eventBus.emit('device:status', { id: this.id, isOnline: true });
      return true;
    }
    if (!this.hidDevice.opened) await this.hidDevice.open();
    this.hidDevice.addEventListener('inputreport', e => this.onReport(e));
    this.isOnline = true;
    try {
      await this.readBattery();
      await this.readAll();
    } catch (e) {
      console.warn('Could not read settings from the mouse:', e);
    }
    clearInterval(this.batteryTimer);
    this.batteryTimer = setInterval(() => this.readBattery().catch(() => {}), 60000);
    eventBus.emit('device:status', { id: this.id, isOnline: true });
    return true;
  }

  async readBattery() {
    const d = await this.transfer(4, 0, 0);
    const level = d[5];
    if (level <= 100) {
      this.battery = level;
      this.charging = !!d[6];
      eventBus.emit('device:battery', { id: this.id, battery: level });
    }
  }

  async disconnect() {
    clearInterval(this.batteryTimer);
    return super.disconnect();
  }

  onReport(e) {
    if (e.reportId !== VXE.REPORT_ID || !this.pending) return;
    const d = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
    if (d[0] === this.pending.cmd) this.pending.resolve(d);
  }

  transfer(cmd, address, length, data) {
    return this.enqueue(async () => {
      const frame = buildFrame(cmd, address, length, data);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const reply = await new Promise(resolve => {
          const timer = setTimeout(() => {
            this.pending = null;
            resolve(null);
          }, 600);
          this.pending = {
            cmd,
            resolve: d => {
              clearTimeout(timer);
              this.pending = null;
              resolve(d);
            }
          };
          this.hidDevice.sendReport(VXE.REPORT_ID, frame).catch(() => {
            clearTimeout(timer);
            this.pending = null;
            resolve(null);
          });
        });
        if (reply) return reply;
      }
      throw new Error(`No reply from mouse for command ${cmd} at ${address}`);
    });
  }

  async get(address, length) {
    const d = await this.transfer(VXE.CMD_GET, address, length);
    return Array.from(d.slice(5, 5 + length));
  }

  async set(address, bytes) {
    if (this.isMock) return;
    await this.transfer(VXE.CMD_SET, address, bytes.length, bytes);
  }

  async readAll() {
    const b0 = await this.get(VXE.ADDR.reportRate, 10);
    this.pollingRate = rateFromCode(b0[0]);
    const count = Math.max(1, Math.min(8, b0[2] || 4));
    this.currentDpiStage = Math.min(count - 1, b0[4] || 0);
    const stages = [];
    for (const addr of VXE.ADDR.dpi) {
      const b = await this.get(addr, 8);
      for (let k = 0; k < 2; k += 1) stages.push(decodeDpi(b[k * 4], b[k * 4 + 2]));
    }
    this.dpiStages = stages.slice(0, count).map((dpi, i) => ({ dpi: dpi || 800, color: COLORS[i % COLORS.length] }));
    this.lod = (await this.get(VXE.ADDR.silentHeight, 2))[0] || 1;
    this.debounceMs = (await this.get(VXE.ADDR.debounce, 2))[0];
    this.movementSync = !!(await this.get(VXE.ADDR.motionSync, 2))[0];
    this.straightCorrection = !!(await this.get(VXE.ADDR.angleSnap, 2))[0];
    this.rippleCorrection = !!(await this.get(VXE.ADDR.ripple, 2))[0];
    await this.readExtras();
  }

  async readExtras() {
    const attempt = async task => {
      try {
        await task();
      } catch (e) {
        console.warn('Could not read a setting from the mouse:', e);
      }
    };
    await attempt(async () => {
      const seconds = (await this.get(VXE.ADDR.sleep, 2))[0] * 10;
      this.sleepTime = reverseLookup(VXE.SLEEP_SECONDS, seconds, this.sleepTime);
    });
    await attempt(async () => {
      const b = await this.get(VXE.ADDR.performance, 6);
      this.sensorMode = b[4] ? 'competitive' : 'basic';
    });
    await attempt(async () => {
      const d = await this.transfer(VXE.CMD_FAR_GET, 0, 0);
      this.longRangeMode = !!d[5];
    });
    await attempt(async () => {
      const b = await this.get(VXE.ADDR.dpiLight, 8);
      this.dpiLightEffect = b[6] ? reverseLookup(VXE.LIGHT_MODE, b[0], 'always') : 'close';
      this.dpiBrightness = reverseLookup(VXE.LIGHT_BRIGHTNESS, b[2], 'medium');
      this.dpiSpeed = reverseLookup(VXE.LIGHT_SPEED, b[4], 'medium');
    });
    await attempt(async () => {
      const d = await this.transfer(VXE.CMD_VERSION, 0, 0);
      this.firmware = `${d[5].toString(16)}.${d[6].toString(16).padStart(2, '0')}`;
    });
    await attempt(async () => {
      for (let i = 0; i < this.buttons.length; i += 2) {
        const b = await this.get(VXE.ADDR.buttons[i], 8);
        for (let k = 0; k < 2; k += 1) {
          const slot = this.buttons[this.slotToButton(i + k)];
          if (slot) slot.currentAction = decodeAction(b[k * 4], b[k * 4 + 1], b[k * 4 + 2]) || 'Custom';
        }
      }
    });
  }

  slotToButton(slot) {
    const order = ['btn_left', 'btn_right', 'btn_middle', 'btn_back', 'btn_forward', 'btn_dpi'];
    return this.buttons.findIndex(b => b.id === order[slot]);
  }

  buttonSlot(btnId) {
    return ['btn_left', 'btn_right', 'btn_middle', 'btn_back', 'btn_forward', 'btn_dpi'].indexOf(btnId);
  }

  async updateBlock0(mutate) {
    if (this.isMock) return;
    const b = await this.get(VXE.ADDR.reportRate, 10);
    mutate(b);
    await this.set(VXE.ADDR.reportRate, b);
  }

  async setField(address, value) {
    await this.set(address, [value & 0xff, check(value)]);
  }

  async setPollingRate(hz) {
    await super.setPollingRate(hz);
    const code = VXE.RATE_CODE[hz];
    if (code) await this.updateBlock0(b => {
      b[0] = code;
      b[1] = check(code);
    });
    return true;
  }

  async setDpiStage(index) {
    await super.setDpiStage(index);
    await this.updateBlock0(b => {
      b[4] = index;
      b[5] = check(index);
    });
    return true;
  }

  async setDpiStageCount() {
    const n = this.dpiStages.length;
    await this.updateBlock0(b => {
      b[2] = n;
      b[3] = check(n);
      if (b[4] >= n) {
        b[4] = n - 1;
        b[5] = check(n - 1);
      }
    });
    for (let i = 0; i < n; i += 1) await this.writeDpi(i);
  }

  async setDpiValue(index, dpi) {
    if (!this.dpiStages[index]) return;
    this.dpiStages[index].dpi = dpi;
    eventBus.emit('mouse:dpi_updated', { stage: index, dpi });
    await this.writeDpi(index);
  }

  async writeDpi(index) {
    if (this.isMock) return;
    const enc = encodeDpi(this.dpiStages[index].dpi);
    if (!enc) return;
    const addr = VXE.ADDR.dpi[Math.floor(index / 2)];
    const b = await this.get(addr, 8);
    const o = (index % 2) * 4;
    b[o] = enc.x;
    b[o + 1] = enc.y;
    b[o + 2] = enc.ex;
    b[o + 3] = check(enc.x + enc.y + enc.ex);
    await this.set(addr, b);
  }

  async setLod(mm) {
    await super.setLod(mm);
    await this.setField(VXE.ADDR.silentHeight, mm);
    return true;
  }

  async setDebounce(ms) {
    await super.setDebounce(ms);
    await this.setField(VXE.ADDR.debounce, ms);
    return true;
  }

  async setToggle(key, value) {
    if (key === 'longRangeMode') return this.setLongRange(value);
    await super.setToggle(key, value);
    if (TOGGLE_ADDR[key] != null) await this.setField(TOGGLE_ADDR[key], value ? 1 : 0);
    return true;
  }

  async setSleepTime(label) {
    await super.setSleepTime(label);
    const seconds = VXE.SLEEP_SECONDS[label];
    if (this.isMock || !seconds) return true;
    const t = seconds / 10;
    await this.setField(VXE.ADDR.sleep, t);
    const b = await this.get(VXE.ADDR.performance, 6);
    b[0] = 1;
    b[1] = check(1);
    b[2] = t;
    b[3] = check(t);
    await this.set(VXE.ADDR.performance, b);
    return true;
  }

  async setSensorMode(mode) {
    await super.setSensorMode(mode);
    if (this.isMock) return true;
    const v = mode === 'competitive' ? 1 : 0;
    const b = await this.get(VXE.ADDR.performance, 6);
    b[4] = v;
    b[5] = check(v);
    await this.set(VXE.ADDR.performance, b);
    return true;
  }

  async setLongRange(on) {
    this.longRangeMode = on;
    eventBus.emit('mouse:param_updated', { key: 'longRangeMode', value: on });
    if (this.isMock) return true;
    await this.transfer(VXE.CMD_FAR_SET, 0, 10, [on ? 1 : 0]);
    return true;
  }

  async setDpiLight(patch) {
    await super.setDpiLight(patch);
    if (this.isMock) return true;
    const b = await this.get(VXE.ADDR.dpiLight, 8);
    const enabled = this.dpiLightEffect === 'close' ? 0 : 1;
    const mode = VXE.LIGHT_MODE[this.dpiLightEffect] || (b[0] === 1 || b[0] === 2 ? b[0] : 1);
    const brightness = VXE.LIGHT_BRIGHTNESS[this.dpiBrightness];
    const speed = VXE.LIGHT_SPEED[this.dpiSpeed];
    const next = [mode, check(mode), brightness, check(brightness), speed, check(speed), enabled, check(enabled)];
    await this.set(VXE.ADDR.dpiLight, next);
    return true;
  }

  async remapButton(btnId, action) {
    const slot = this.buttonSlot(btnId);
    const bytes = encodeAction(action);
    if (!this.isMock && slot >= 0 && bytes) await this.set(VXE.ADDR.buttons[slot], bytes);
    return super.remapButton(btnId, action);
  }

  async startPairing() {
    if (this.isMock) return null;
    const id = await this.transfer(VXE.CMD_CIDMID, 0, 0);
    await this.transfer(VXE.CMD_PAIR, 0, 2, [id[5], id[6]]);
    return this.pairingStatus();
  }

  async pairingStatus() {
    const d = await this.transfer(VXE.CMD_PAIR_STATUS, 0, 0);
    return { status: d[5], secondsLeft: d[6] };
  }
}
