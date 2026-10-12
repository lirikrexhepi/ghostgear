import { el, group, header, slider } from '../controls.js';

const minutes = s => Math.max(1, Math.round(s / 60));
const fmtMin = v => `${v} min`;

export class KeyboardSettingsSection {
  constructor() {
    this.id = 'settings';
    this.label = 'Settings';
    this.interactive = false;
  }

  enter(ctx) {
    this.ctx = ctx;
    const d = ctx.device;
    const t = d.sleepTimers;

    const debounce = slider({
      label: 'Debounce',
      min: 1,
      max: 30,
      value: d.debounceMs,
      format: v => `${v} ms`,
      onChange: v => d.setDebounce(v)
    });

    const sleep = slider({
      label: 'Sleep after',
      min: 1,
      max: 30,
      value: minutes(t.time24),
      format: fmtMin,
      onChange: v => d.setSleep({ time24: v * 60, timeBT: v * 60 })
    });

    const deep = slider({
      label: 'Power off after',
      min: 5,
      max: 120,
      step: 5,
      value: Math.min(120, Math.max(5, Math.round(minutes(t.deep24) / 5) * 5)),
      format: fmtMin,
      onChange: v => d.setSleep({ deep24: v * 60, deepBT: v * 60 })
    });

    ctx.scroll.replaceChildren(
      header('Settings'),
      group('Typing', [debounce, el('p', { class: 'hint', text: 'Lower is faster. Raise it if keys double-type.' })]),
      group('Wireless', [sleep, deep])
    );
    ctx.foot.replaceChildren(el('span', { text: d.isMock ? 'Demo device' : 'Saved to the keyboard' }));
  }

  leave() {}
}
