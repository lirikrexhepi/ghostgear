import { BaseDevice } from '../base-device.js';
import { eventBus } from '../../core/event-bus.js';

export class BaseMouseDevice extends BaseDevice {
  constructor(options = {}) {
    super({
      ...options,
      type: 'mouse'
    });

    // Standard gaming mouse configuration defaults
    this.dpiStages = options.dpiStages || [
      { dpi: 400, color: '#FF453A' },
      { dpi: 800, color: '#0A84FF' },
      { dpi: 1600, color: '#30D158' },
      { dpi: 3200, color: '#FFD60A' }
    ];
    this.currentDpiStage = options.currentDpiStage ?? 1; // 800 DPI default
    this.pollingRate = options.pollingRate ?? 1000; // 1000Hz default
    this.lod = options.lod ?? 1; // 1mm
    this.debounceMs = options.debounceMs ?? 8; // 8ms click debounce (default)
    this.sensorMode = options.sensorMode ?? 'competitive';
    this.sleepTime = options.sleepTime ?? '1min';
    this.movementSync = options.movementSync ?? false;
    this.straightCorrection = options.straightCorrection ?? false;
    this.rippleCorrection = options.rippleCorrection ?? false;
    this.longRangeMode = options.longRangeMode ?? false;
    this.dpiLightEffect = options.dpiLightEffect ?? 'close';
    this.dpiBrightness = options.dpiBrightness ?? 'medium';
    this.dpiSpeed = options.dpiSpeed ?? 'medium';

    // Mouse buttons
    this.buttons = options.buttons || [
      { id: 'btn_left', name: 'Left button', defaultAction: 'Left Click', currentAction: 'Left Click' },
      { id: 'btn_right', name: 'Right button', defaultAction: 'Right Click', currentAction: 'Right Click' },
      { id: 'btn_middle', name: 'Wheel', defaultAction: 'Middle Click', currentAction: 'Middle Click' },
      { id: 'btn_forward', name: 'Front side button', defaultAction: 'Forward', currentAction: 'Forward' },
      { id: 'btn_back', name: 'Rear side button', defaultAction: 'Back', currentAction: 'Back' },
      { id: 'btn_dpi', name: 'Bottom button', defaultAction: 'DPI Cycle', currentAction: 'DPI Cycle' }
    ];
  }

  async setDpiStage(stageIndex) {
    this.currentDpiStage = stageIndex;
    eventBus.emit('mouse:dpi_updated', { stage: stageIndex, dpi: this.dpiStages[stageIndex]?.dpi });
    return true;
  }

  async setDpiStageCount() {
    eventBus.emit('mouse:dpi_updated', { count: this.dpiStages.length });
    return true;
  }

  async setDpiValue(index, dpi) {
    if (this.dpiStages[index]) this.dpiStages[index].dpi = dpi;
    eventBus.emit('mouse:dpi_updated', { stage: index, dpi });
    return true;
  }

  async setPollingRate(hz) {
    this.pollingRate = hz;
    eventBus.emit('mouse:polling_updated', hz);
    return true;
  }

  async setLod(mm) {
    this.lod = mm;
    eventBus.emit('mouse:lod_updated', mm);
    return true;
  }

  async setDebounce(ms) {
    this.debounceMs = ms;
    eventBus.emit('mouse:debounce_updated', ms);
    return true;
  }

  async setSensorMode(mode) {
    this.sensorMode = mode;
    eventBus.emit('mouse:sensor_updated', mode);
    return true;
  }

  async setSleepTime(label) {
    this.sleepTime = label;
    eventBus.emit('mouse:sleep_updated', label);
    return true;
  }

  async setToggle(key, value) {
    this[key] = value;
    eventBus.emit('mouse:param_updated', { key, value });
    return true;
  }

  async setDpiLight(patch) {
    if (patch.effect) this.dpiLightEffect = patch.effect;
    if (patch.brightness) this.dpiBrightness = patch.brightness;
    if (patch.speed) this.dpiSpeed = patch.speed;
    eventBus.emit('mouse:dpilight_updated', {
      effect: this.dpiLightEffect,
      brightness: this.dpiBrightness,
      speed: this.dpiSpeed
    });
    return true;
  }

  async remapButton(btnId, action) {
    const btn = this.buttons.find(b => b.id === btnId);
    if (btn) {
      btn.currentAction = action;
      eventBus.emit('mouse:button_remapped', { btnId, action });
    }
    return true;
  }
}
