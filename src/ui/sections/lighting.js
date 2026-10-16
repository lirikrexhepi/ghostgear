import { el, group, header, slider, toggle, row, CHECK } from '../controls.js';
const CHEVRON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const CHEVRON_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
import { LIGHT_EFFECTS, MK12Protocol } from '../../devices/keyboard/mk12-protocol.js';

const SWATCHES = ['#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF2D55'];
const STATIC = 1;
const BREATH = 2;
const OFF = 0;

const hex = n => `#${n.toString(16).padStart(6, '0').toUpperCase()}`;

export class LightingSection {
  constructor() {
    this.id = 'lighting';
    this.label = 'Lighting';
    this.interactive = false;
    this.raf = 0;
  }

  enter(ctx) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.picking = false;
    this.render();
    this.startPreview();
  }

  leave() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const v = this.ctx && this.ctx.viewer;
    if (v) {
      v.setRGB(null);
      v.clearPartLights();
    }
  }

  onViewer() {
    this.startPreview();
  }

  get s() {
    return this.device.lightState;
  }

  set(patch, rerender = false) {
    this.device.setLighting(patch);
    if (rerender) this.render();
    else this.paintState();
  }

  renderEffects() {
    const { scroll } = this.ctx;
    const s = this.s;
    const back = el('button', { class: 'back-link', html: `${CHEVRON_L}<span>Lighting</span>` });
    back.addEventListener('click', () => {
      this.picking = false;
      this.preview = null;
      this.render();
    });
    const grid = el('div', { class: 'chips wide', role: 'listbox', 'aria-label': 'Effect' });
    LIGHT_EFFECTS.forEach(e => {
      const on = e.index === s.effectIndex;
      const chip = el('button', { class: 'chip', role: 'option', 'aria-selected': String(on), 'aria-pressed': String(on), text: e.name });
      chip.addEventListener('mouseenter', () => {
        this.preview = e.index;
      });
      chip.addEventListener('focus', () => {
        this.preview = e.index;
      });
      chip.addEventListener('mouseleave', () => {
        this.preview = null;
      });
      chip.addEventListener('click', () => {
        this.device.setLighting({ effectIndex: e.index });
        this.preview = null;
        this.picking = false;
        this.render();
      });
      grid.appendChild(chip);
    });
    scroll.replaceChildren(back, header('Effect', 'Hover to preview on the keyboard.'), group('', [grid]));
    scroll.scrollTop = 0;
  }

  render() {
    if (this.picking) {
      this.renderEffects();
      return;
    }
    const { scroll, foot } = this.ctx;
    const s = this.s;
    const keepTop = scroll.scrollTop;
    const effect = LIGHT_EFFECTS.find(e => e.index === s.effectIndex);
    const effectRow = el('button', { class: 'drill' }, [
      el('span', { class: 'row-label', text: 'Effect' }),
      el('span', { class: 'drill-value' }, [el('span', { text: effect ? effect.name : 'Custom' }), el('span', { html: CHEVRON_R, style: { display: 'flex' } })])
    ]);
    effectRow.addEventListener('click', () => {
      this.picking = true;
      this.render();
    });

    const off = s.effectIndex === OFF;
    const animated = !off && s.effectIndex !== STATIC;

    this.swatchButtons = [];
    const swatches = el('div', { class: 'swatches' });
    SWATCHES.forEach(c => {
      const b = el('button', { class: 'swatch', style: { background: c }, 'aria-label': c, 'aria-pressed': String(!s.dazzle && hex(s.rgb) === c) });
      b.addEventListener('click', () => this.set({ rgb: parseInt(c.slice(1), 16), dazzle: false }));
      swatches.appendChild(b);
      this.swatchButtons.push({ b, c });
    });
    const picker = el('input', { type: 'color', value: hex(s.rgb).toLowerCase(), 'aria-label': 'Custom color' });
    picker.addEventListener('input', () => this.set({ rgb: parseInt(picker.value.slice(1), 16), dazzle: false }));
    this.customSwatch = el('label', { class: 'swatch custom', title: 'Custom' }, [picker]);
    swatches.appendChild(this.customSwatch);

    const rainbow = toggle(s.dazzle, on => this.set({ dazzle: on }, true), 'Rainbow');

    const brightness = slider({
      label: 'Brightness',
      min: 0,
      max: MK12Protocol.MAX_BRIGHT,
      value: s.bright,
      format: v => `${Math.round((v / MK12Protocol.MAX_BRIGHT) * 100)}%`,
      onInput: v => this.set({ bright: v })
    });
    const speed = slider({
      label: 'Speed',
      min: 0,
      max: MK12Protocol.MAX_SPEED,
      value: s.speed,
      format: v => `${v + 1}`,
      onInput: v => this.set({ speed: v })
    });

    scroll.replaceChildren(
      header('Lighting'),
      group('', [effectRow]),
      off ? null : group('Color', [row('Rainbow', rainbow), s.dazzle ? null : el('div', { style: { padding: '12px 0 4px' } }, [swatches])]),
      off ? null : group('', [brightness, animated ? speed : null])
    );
    foot.replaceChildren();
    scroll.scrollTop = keepTop;
  }

  paintState() {
    const s = this.s;
    (this.swatchButtons || []).forEach(({ b, c }) => b.setAttribute('aria-pressed', String(!s.dazzle && hex(s.rgb) === c)));
  }

  onDeviceUpdate() {}

  startPreview() {
    cancelAnimationFrame(this.raf);
    const start = performance.now();
    let layout = null;
    let order = null;
    let lastOff = false;
    const custom = readCustom();
    const tick = now => {
      this.raf = requestAnimationFrame(tick);
      const v = this.ctx && this.ctx.viewer;
      if (!v) return;
      if (!layout) {
        layout = v.getPartLayout().map((p, i) => ({ ...p, seed: hash(i * 7.13) }));
        order = layout.slice().sort((a, b) => Math.round(a.y) - Math.round(b.y) || (Math.round(a.y) % 2 ? b.x - a.x : a.x - b.x));
        order.forEach((p, i) => {
          p.order = i;
        });
      }
      const s = this.s;
      const effect = this.preview != null ? this.preview : s.effectIndex;
      const level = s.bright / MK12Protocol.MAX_BRIGHT;
      if (effect === OFF || level === 0) {
        if (!lastOff) {
          v.setRGB(null);
          v.clearPartLights();
          lastOff = true;
        }
        return;
      }
      lastOff = false;
      if (effect === 13) {
        v.clearPartLights();
        custom.forEach(([id, c]) => v.setPartLight(id, (c[0] / 255) * level * 1.4, (c[1] / 255) * level * 1.4, (c[2] / 255) * level * 1.4));
        v.setRGB(null);
        return;
      }
      const t = ((now - start) / 1000) * (0.35 + s.speed * 0.2);
      const base = hexToRgb(s.rgb);
      let sr = 0;
      let sg = 0;
      let sb = 0;
      layout.forEach(p => {
        const [k, hue] = lightAt(effect, p, t, layout.length);
        const c = s.dazzle ? hslToRgb(((hue % 360) + 360) % 360) : base;
        const a = Math.max(0, Math.min(1, k)) * level;
        sr += c[0] * a;
        sg += c[1] * a;
        sb += c[2] * a;
        v.setPartLight(p.id, c[0] * a * 1.4, c[1] * a * 1.4, c[2] * a * 1.4);
      });
      const n = layout.length;
      const peak = Math.max(sr, sg, sb) / n || 0;
      if (peak > 0.001) {
        const r = Math.round((sr / n / peak) * 255);
        const g = Math.round((sg / n / peak) * 255);
        const b = Math.round((sb / n / peak) * 255);
        v.setRGB(`rgb(${r},${g},${b})`, Math.min(1, peak) * level * 0.25);
      } else {
        v.setRGB(null);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function frac(x) {
  return x - Math.floor(x);
}

function hexToRgb(n) {
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hslToRgb(h) {
  const f = n => {
    const k = (n + h / 30) % 12;
    return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function readCustom() {
  try {
    const raw = JSON.parse(localStorage.getItem('gear_paint_current') || '{}');
    return Object.entries(raw).map(([id, hexColor]) => [
      id === 'IntlRo' ? 'Backslash' : id,
      [parseInt(hexColor.slice(1, 3), 16), parseInt(hexColor.slice(3, 5), 16), parseInt(hexColor.slice(5, 7), 16)]
    ]);
  } catch (e) {
    return [];
  }
}

function lightAt(effect, p, t, count) {
  const cx = 8;
  const cy = 2.5;
  const dx = p.x - cx;
  const dy = (p.y - cy) * 1.6;
  const d = Math.sqrt(dx * dx + dy * dy);
  switch (effect) {
    case 1:
      return [1, p.x * 22];
    case 2:
      return [0.5 - 0.5 * Math.cos(t * 3), t * 40];
    case 3:
      return [1, t * 90];
    case 4:
      return [1, p.x * 22 - t * 160];
    case 5: {
      const r = frac(t * 0.45) * 11;
      return [Math.max(0, 1 - Math.abs(d - r) * 0.9), d * 30 + t * 60];
    }
    case 6:
    case 17: {
      const ph = frac(t * 0.6 + p.seed);
      return [effect === 17 ? Math.max(0, 1 - Math.abs(p.y - (frac(t * 0.6 + hash(Math.round(p.x))) * 7 - 1)) * 1.2) : Math.pow(Math.max(0, 1 - ph * 3), 2), p.seed * 360];
    }
    case 7:
    case 23: {
      const len = effect === 7 ? 8 : 4;
      const head = frac(t * 0.25) * count;
      const back = (head - p.order + count) % count;
      const on = effect === 7 ? back < len : back % 12 < len;
      return [on ? 1 - back / (effect === 7 ? len : 12) : 0, p.order * 8 + t * 60];
    }
    case 8:
    case 19: {
      const ph = frac(t * 0.35 + p.seed);
      const flash = Math.pow(Math.max(0, 1 - ph * 4), 1.5);
      return [effect === 8 ? flash : 1 - flash, p.seed * 360];
    }
    case 9: {
      const r = (1 - frac(t * 0.5)) * 8.5;
      return [Math.max(0, 1 - Math.abs(Math.abs(dx) - r) * 0.8), Math.abs(dx) * 30 + t * 60];
    }
    case 10:
      return [0.5 + 0.5 * Math.sin(p.x * 0.7 - t * 3), p.x * 22 - t * 80];
    case 11:
      return [1, (Math.atan2(dy, dx) * 180) / Math.PI + t * 120];
    case 12:
      return [Math.max(0, 1 - Math.abs(p.x - frac(t * 0.4) * 18 + 1) / 1.6), p.x * 22];
    case 14:
      return [Math.max(0, 1 - Math.abs(p.y - (frac(t * 0.5) * 6.5 - 0.75)) * 1.3), p.y * 60 + t * 40];
    case 15:
      return [0.55 + 0.45 * Math.sin(d * 1.1 - t * 3), d * 40 - t * 120];
    case 16:
      return [0.6 + 0.4 * hash(p.seed * 31 + Math.floor(t * 4)), hash(p.seed * 17 + Math.floor(t * 4)) * 360];
    case 18: {
      const row = Math.round(p.y);
      const head = frac(t * 0.35 + row * 0.21) * 22 - 3;
      const back = head - p.x;
      return [back >= 0 && back < 5 ? 1 - back / 5 : 0, row * 70 + t * 40];
    }
    case 24: {
      const burst = Math.floor(t * 0.5);
      const bx = hash(burst * 3.1) * 16;
      const by = hash(burst * 5.7) * 5;
      const ex = p.x - bx;
      const ey = (p.y - by) * 1.6;
      const r = frac(t * 0.5) * 9;
      return [Math.max(0, 1 - Math.abs(Math.sqrt(ex * ex + ey * ey) - r)) * (1 - frac(t * 0.5)), hash(burst) * 360];
    }
    default:
      return [1, p.x * 22 - t * 120];
  }
}
