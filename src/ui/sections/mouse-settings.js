import { el, group, header, slider, toggle, row, stack, segmented } from '../controls.js';

const SLEEP = ['30s', '1min', '2min', '3min', '5min', '20min', '25min', '30min'];
const SLEEP_LABEL = { '30s': '30 s', '1min': '1 min', '2min': '2 min', '3min': '3 min', '5min': '5 min', '20min': '20 min', '25min': '25 min', '30min': '30 min' };
const DEBOUNCE = [0, 1, 2, 4, 8, 15, 20];
const SENSOR = [{ value: 'basic', label: 'Basic' }, { value: 'competitive', label: 'Competitive' }];
const LIGHT = [{ value: 'close', label: 'Off' }, { value: 'always', label: 'Always on' }, { value: 'breathing', label: 'Breathing' }];
const BRIGHTNESS = [{ value: 'min', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'max', label: 'High' }];
const SPEED = [{ value: 'slowest', label: 'Slow' }, { value: 'medium', label: 'Medium' }, { value: 'fastest', label: 'Fast' }];

function deviceRows(d) {
  const rows = [];
  if (d.firmware) rows.push(row('Firmware', el('span', { class: 'row-value', text: `v${d.firmware}` }), 'chip'));
  if (!d.isMock && d.startPairing) rows.push(pairRow(d));
  return rows;
}

function pairRow(d) {
  const status = el('span', { class: 'row-value' });
  const button = el('button', { class: 'link', type: 'button', text: 'Pair now' });
  let timer = null;
  const reset = () => {
    clearInterval(timer);
    timer = null;
    button.textContent = 'Pair now';
    button.classList.remove('danger');
  };
  const poll = async () => {
    try {
      const { secondsLeft } = await d.pairingStatus();
      if (secondsLeft > 0) status.textContent = `Press the pair button on the mouse · ${secondsLeft} s`;
      else {
        status.textContent = '';
        reset();
      }
    } catch (e) {
      status.textContent = '';
      reset();
    }
  };
  button.addEventListener('click', async () => {
    if (timer) return;
    if (!button.classList.contains('danger')) {
      button.classList.add('danger');
      button.textContent = 'Confirm';
      setTimeout(() => {
        if (!timer) reset();
      }, 4000);
      return;
    }
    button.textContent = 'Pairing';
    try {
      const first = await d.startPairing();
      status.textContent = first && first.secondsLeft > 0 ? `Press the pair button on the mouse · ${first.secondsLeft} s` : 'Press the pair button on the mouse';
      timer = setInterval(poll, 1000);
    } catch (e) {
      status.textContent = "Couldn't start pairing";
      reset();
    }
  });
  const right = el('span', { class: 'row-actions' }, [status, button]);
  return row('Pair receiver', right, 'pair');
}

export class MouseSettingsSection {
  constructor() {
    this.id = 'settings';
    this.label = 'Settings';
    this.interactive = false;
  }

  enter(ctx) {
    const d = ctx.device;
    const polling = segmented(
      [125, 250, 500, 1000].map(r => ({ value: r, label: r === 1000 ? '1K' : String(r) })),
      d.pollingRate,
      v => d.setPollingRate(v),
      { small: true, label: 'Polling rate' }
    );
    const lod = segmented(
      [{ value: 1, label: '1 mm' }, { value: 2, label: '2 mm' }],
      d.lod,
      v => d.setLod(v),
      { small: true, label: 'Lift-off distance' }
    );
    const sensor = segmented(SENSOR, d.sensorMode, v => d.setSensorMode(v), { small: true, label: 'Sensor mode' });
    const debounce = segmented(
      DEBOUNCE.map(v => ({ value: v, label: String(v) })),
      DEBOUNCE.includes(d.debounceMs) ? d.debounceMs : null,
      v => d.setDebounce(v),
      { small: true, label: 'Click debounce in milliseconds' }
    );
    const sleepIndex = Math.max(0, SLEEP.indexOf(d.sleepTime));
    const sleep = slider({
      icon: 'sleep',
      label: 'Sleep after',
      min: 0,
      max: SLEEP.length - 1,
      value: sleepIndex,
      format: i => SLEEP_LABEL[SLEEP[i]],
      onChange: i => d.setSleepTime(SLEEP[i])
    });
    const flag = (key, label, icon) => row(label, toggle(d[key], on => d.setToggle(key, on), label), icon);

    const lightDetail = el('div');
    const paintLight = () => {
      const rows = [];
      if (d.dpiLightEffect !== 'close') {
        rows.push(row('Brightness', segmented(BRIGHTNESS, d.dpiBrightness, v => d.setDpiLight({ brightness: v }), { small: true, label: 'DPI light brightness' }), 'brightness'));
      }
      if (d.dpiLightEffect === 'breathing') {
        rows.push(row('Speed', segmented(SPEED, d.dpiSpeed, v => d.setDpiLight({ speed: v }), { small: true, label: 'DPI light speed' }), 'speed'));
      }
      lightDetail.replaceChildren(...rows);
    };
    const light = segmented(LIGHT, d.dpiLightEffect, v => {
      d.setDpiLight({ effect: v });
      paintLight();
    }, { small: true, label: 'DPI light effect' });
    paintLight();

    const deviceGroup = deviceRows(d);
    ctx.scroll.replaceChildren(
      header('Settings'),
      group('Sensor', [row('Polling rate', polling, 'polling'), row('Lift-off distance', lod, 'liftoff'), stack('Sensor mode', sensor, 'sensor')]),
      group('Tracking', [
        flag('movementSync', 'Motion sync', 'sync'),
        flag('straightCorrection', 'Angle snapping', 'angle'),
        flag('rippleCorrection', 'Ripple control', 'ripple')
      ]),
      group('Clicks', [stack('Click debounce (ms)', debounce, 'click')]),
      group('Power', [sleep, flag('longRangeMode', 'Ultra long range', 'range')]),
      group('DPI light', [stack('Effect', light, 'light'), lightDetail]),
      ...(deviceGroup.length ? [group('Device', deviceGroup)] : [])
    );

    ctx.foot.replaceChildren(el('span', { text: d.isMock ? 'Demo device' : 'Saved to the mouse' }));
  }

  leave() {}
}
