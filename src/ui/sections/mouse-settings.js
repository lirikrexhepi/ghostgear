import { el, group, header, slider, toggle, row, segmented } from '../controls.js';

const SLEEP = ['30s', '1min', '2min', '4min', '5min', '10min', '25min', '30min'];
const SLEEP_LABEL = { '30s': '30 s', '1min': '1 min', '2min': '2 min', '4min': '4 min', '5min': '5 min', '10min': '10 min', '25min': '25 min', '30min': '30 min' };

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
    const debounce = slider({ label: 'Click debounce', min: 0, max: 20, value: d.debounceMs, format: v => `${v} ms`, onChange: v => d.setDebounce(v) });
    const sleepIndex = Math.max(0, SLEEP.indexOf(d.sleepTime));
    const sleep = slider({
      label: 'Sleep after',
      min: 0,
      max: SLEEP.length - 1,
      value: sleepIndex,
      format: i => SLEEP_LABEL[SLEEP[i]],
      onChange: i => d.setSleepTime(SLEEP[i])
    });
    const flag = (key, label) => row(label, toggle(d[key], on => d.setToggle(key, on), label));

    ctx.scroll.replaceChildren(
      header('Settings'),
      group('Sensor', [row('Polling rate', polling), row('Lift-off distance', lod)]),
      group('Tracking', [
        flag('movementSync', 'Motion sync'),
        flag('straightCorrection', 'Angle snapping'),
        flag('rippleCorrection', 'Ripple control')
      ]),
      group('Clicks', [debounce])
    );
    ctx.foot.replaceChildren();
  }

  leave() {}
}
